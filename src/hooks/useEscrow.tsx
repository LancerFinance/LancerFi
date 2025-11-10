import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from './useWallet';
import { createEscrowAccount, fundEscrowWithCurrency, releaseEscrowPayment, connection, PaymentCurrency, formatSOL, formatUSDC, getLatestBlockhashWithFallback, sendRawTransactionViaProxy, getAccountBalanceViaProxy, verifyTransaction } from '@/lib/solana';
import { db } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { releasePaymentToFreelancer as releasePaymentAPI } from '@/lib/api-client';
import { requestX402Payment, processX402Payment, verifyX402Payment, X402PaymentChallenge } from '@/lib/x402-payment';
import { useRateLimit } from '@/hooks/useRateLimit';

interface UseEscrowReturn {
  createProjectEscrow: (projectId: string, amount: number, paymentCurrency: PaymentCurrency) => Promise<string | null>;
  fundEscrow: (escrowId: string, amount: number, paymentCurrency: PaymentCurrency) => Promise<boolean>;
  releasePayment: (escrowId: string, milestoneId: string) => Promise<boolean>;
  releasePaymentToFreelancer: (escrowId: string, freelancerWallet: string) => Promise<boolean>;
  isLoading: boolean;
}

export const useEscrow = (): UseEscrowReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const { provider, address, signMessage } = useWallet();
  const { toast } = useToast();
  const { canProceed: canCreateEscrow } = useRateLimit({ minTimeBetweenCalls: 2000, actionName: 'creating escrow' });
  const { canProceed: canFundEscrow } = useRateLimit({ minTimeBetweenCalls: 2000, actionName: 'funding escrow' });
  const { canProceed: canReleasePayment } = useRateLimit({ minTimeBetweenCalls: 2000, actionName: 'releasing payment' });

  const createProjectEscrow = useCallback(async (
    projectId: string, 
    amount: number,
    paymentCurrency: PaymentCurrency = 'SOLANA'
  ): Promise<string | null> => {
    // Rate limiting check
    if (!canCreateEscrow()) {
      return null;
    }

    const w: any = window as any;
    const ph = w.solana;
    if (!ph?.isPhantom) {
      toast({
        title: "Phantom required",
        description: "Please connect your Phantom (Solana) wallet to create escrow",
        variant: "destructive",
      });
      return null;
    }
    if (!ph.isConnected) {
      try { await ph.connect(); } catch {
        toast({ title: "Wallet not connected", description: "Phantom connection was rejected", variant: "destructive" });
        return null;
      }
    }
    const solAddress: string | undefined = ph.publicKey?.toString?.();
    if (!solAddress) {
      toast({ title: "Wallet error", description: "Could not read Phantom public key", variant: "destructive" });
      return null;
    }

    setIsLoading(true);
    try {
      const clientWallet = new PublicKey(solAddress);
      const platformFeePercent = 10; // 10% platform fee
      
      let finalAmount = amount;
      let actualCurrency: PaymentCurrency = paymentCurrency;
      
      const platformFee = (finalAmount * platformFeePercent) / 100;
      const totalLocked = finalAmount + platformFee;

      // Handle x402 payment flow
      // Use strict comparison and also check for string equality
      const isX402 = paymentCurrency === 'X402' || String(paymentCurrency).toUpperCase() === 'X402';
      
      if (isX402) {

        // Step 1: Request payment challenge from backend (HTTP 402)
        toast({
          title: "Requesting payment...",
          description: "Please wait while we prepare your payment.",
        });

        let paymentChallenge: X402PaymentChallenge;
        try {
          paymentChallenge = await requestX402Payment(
            projectId,
            finalAmount,
            clientWallet.toString()
          );
        } catch (x402Error: any) {
          console.error('x402 Payment challenge failed');
          setIsLoading(false);
          throw new Error(`x402 payment request failed: ${x402Error.message || 'Unknown error'}. Please try again or use a different payment method.`);
        }

        // Step 2: Process payment with user's wallet
        toast({
          title: "Processing payment...",
          description: "Please approve the transaction in your wallet.",
        });

        let transactionSignature: string;
        try {
          transactionSignature = await processX402Payment(paymentChallenge, ph);
        } catch (x402PaymentError: any) {
          console.error('x402 Payment processing failed');
          setIsLoading(false);
          throw new Error(`x402 payment processing failed: ${x402PaymentError.message || 'Unknown error'}. Please try again or use a different payment method.`);
        }

        // Step 3: Verify payment with backend
        toast({
          title: "Verifying payment...",
          description: "Please wait while we verify your payment on-chain.",
        });

        // Quick initial check - if transaction is already confirmed, verify immediately
        // Otherwise, retry with exponential backoff
        let verification: { success: boolean; error?: string } = { success: false };
        let retries = 0;
        const maxRetries = 8; // Up to 8 attempts (about 10-15 seconds total)
        
        while (!verification.success && retries < maxRetries) {
          // Wait before retry (exponential backoff: 1s, 1.5s, 2s, 2.5s, etc.)
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 500 + (retries * 500)));
          }
          
          verification = await verifyX402Payment(
            projectId,
            transactionSignature,
            clientWallet.toString(),
            parseFloat(paymentChallenge.amount)
          );
          
          if (verification.success) {
            break; // Success - exit loop
          }
          
          // If error is "not found", retry (transaction might still be confirming)
          if (verification.error?.includes('not found') || verification.error?.includes('Transaction not found')) {
            retries++;
            continue;
          }
          
          // If it's a different error (transaction failed, amount mismatch, etc.), don't retry
          break;
        }

        if (!verification.success) {
          // If verification fails but transaction was sent, log the error for debugging
          console.error('x402 payment verification failed:', {
            transactionSignature,
            error: verification.error,
            projectId,
            amount: parseFloat(paymentChallenge.amount)
          });
          throw new Error(verification.error || 'Payment verification failed after multiple attempts');
        }

        // Step 4: Create escrow record in database (payment already made to platform wallet)
        // For x402, the escrow is the platform wallet, and payment is already there
        // Set escrow_account to platform wallet address so release payment can find it
        const { PLATFORM_WALLET } = await import('@/lib/solana');
        const escrowData = {
          project_id: projectId,
          client_wallet: clientWallet.toString(),
          amount_usdc: finalAmount, // x402 uses USDC
          platform_fee: platformFee,
          total_locked: totalLocked,
          transaction_signature: transactionSignature,
          payment_currency: 'USDC', // x402 uses USDC
          escrow_account: PLATFORM_WALLET.toString(), // Platform wallet is the escrow for x402
          status: 'funded' as const,
          funded_at: new Date().toISOString(),
        };

        console.log('Creating escrow with data:', escrowData);
        
        let escrow;
        try {
          escrow = await db.createEscrow(escrowData);

          if (!escrow) {
            console.error('Escrow creation returned no data');
            throw new Error('Failed to create escrow record - no data returned');
          }

          console.log('Escrow created successfully:', escrow.id);
        } catch (escrowCreateError: any) {
          console.error('Exception during escrow creation:', escrowCreateError);
          // Log full error details for debugging
          console.error('Escrow error details:', {
            message: escrowCreateError.message,
            details: escrowCreateError.details,
            hint: escrowCreateError.hint,
            code: escrowCreateError.code
          });
          // Re-throw with more context
          throw new Error(`Failed to create escrow record: ${escrowCreateError.message || 'Unknown error'}`);
        }

        toast({
          title: "Payment Successful!",
          description: `Your x402 payment of ${formatUSDC(totalLocked)} has been processed and escrow is funded.`,
        });

        setIsLoading(false);
        return escrow.id;
      }

      // CRITICAL SAFEGUARD: If we reach here and paymentCurrency is X402, something went wrong
      // This should NEVER happen - the x402 block should always return or throw
      if (String(paymentCurrency).toUpperCase() === 'X402') {
        console.error('x402 payment flow did not return or throw');
        setIsLoading(false);
        throw new Error('x402 payment flow failed unexpectedly. The payment flow did not complete properly. Please try again or use a different payment method.');
      }

      // Original flow for SOLANA and USDC
      // Skip balance check - backend RPC is unreliable
      // Transaction will fail on-chain if balance is insufficient, which is the correct behavior

      // Start blockhash fetch early (in parallel with escrow creation)
      const blockhashPromise = getLatestBlockhashWithFallback();
      
      // Create escrow account on Solana (internally using single token)
      // Use the actual paymentCurrency, not hardcoded 'SOLANA'
      const { escrowAccount, transaction } = await createEscrowAccount(
        clientWallet,
        projectId,
        finalAmount,
        paymentCurrency, // Use actual payment currency (SOLANA or USDC)
        platformFeePercent
      );

      // Get blockhash (should already be ready from parallel fetch)
      const { blockhash, lastValidBlockHeight } = await blockhashPromise;
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Verify transaction structure before sending
      if (!transaction.recentBlockhash) {
        throw new Error('Transaction missing blockhash');
      }
      if (!transaction.feePayer) {
        throw new Error('Transaction missing fee payer');
      }
      if (transaction.instructions.length === 0) {
        throw new Error('Transaction has no instructions');
      }
      
      // Sign and send with Phantom - use sendTransaction which actually broadcasts
      // signAndSendTransaction should work, but let's be explicit about sending
      let signature: string;
      
      try {
        // Use Phantom's signAndSendTransaction - it's more reliable
        // Phantom handles the network connection and broadcasting internally
        
        // Sign with Phantom (user approves in wallet)
        // Note: Blockhash was already set above, no need to get it again (saves 3-4 seconds)
        try {
          // Sign with Phantom (user approves in wallet)
          const signedTransaction = await ph.signTransaction(transaction);
          
          // Serialize immediately after signing
          const serializedTransaction = signedTransaction.serialize();
          
          // Step 2: Send IMMEDIATELY after signing (don't wait - blockhash could expire)
          signature = await sendRawTransactionViaProxy(serializedTransaction);
          
        } catch (phantomError: any) {
          console.error('Phantom transaction error');
          // Check for specific Phantom errors
          if (phantomError?.code === 4001 || phantomError?.message?.includes('User rejected')) {
            throw new Error('Transaction was rejected by user');
          }
          if (phantomError?.message?.includes('insufficient funds') || phantomError?.message?.includes('Insufficient')) {
            throw new Error('Insufficient balance to complete transaction');
          }
          throw new Error(`Phantom transaction failed: ${phantomError?.message || 'Unknown error'}`);
        }
        
        // Phantom's signAndSendTransaction already confirms the transaction
        // Do a quick single check (non-blocking) - if it fails, proceed anyway since Phantom confirmed it
        // This reduces wait time from 2-3 seconds to <500ms
        try {
          // Quick single check (don't wait for it)
          const quickCheck = verifyTransaction(signature);
          
          // Wait just 200ms for initial propagation, then check
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const verification = await quickCheck;
          
          // Only throw if transaction has a real error (not "not found" or 403)
          if (verification.error && 
              !verification.error.includes('not found') && 
              !verification.error.includes('403') &&
              !verification.error.includes('RPC access blocked')) {
            throw new Error(`Transaction failed on-chain: ${verification.error}`);
          }
          
          // If verified or can't verify (403/not found), proceed - Phantom already confirmed it
        } catch (verifyError: any) {
          // If it's not a real transaction error, proceed anyway
          if (!verifyError?.message?.includes('failed on-chain')) {
            // Can't verify but Phantom confirmed it - proceed
          } else {
            throw verifyError;
          }
        }
        
      } catch (error: any) {
        console.error('Error with transaction');
        // If user rejected, let them know
        if (error?.message?.includes('User rejected') || error?.code === 4001) {
          throw new Error('Transaction was rejected by user');
        }
        throw error;
      }

      // Transaction verified - safe to create escrow
      const escrow = await db.createEscrow({
        project_id: projectId,
        client_wallet: solAddress,
        amount_usdc: finalAmount, // Internal accounting amount (SOL if paymentCurrency is SOLANA)
        platform_fee: platformFee,
        total_locked: totalLocked,
        escrow_account: escrowAccount.toString(),
        transaction_signature: signature,
        status: 'funded',
        payment_currency: actualCurrency // Store the payment currency used
      });

      toast({
        title: "Escrow Created",
        description: paymentCurrency === 'USDC' 
          ? `Successfully created escrow with ${amount} USDC`
          : `Successfully locked ${formatSOL(amount)} in smart contract escrow`,
      });

      return escrow.id;
    } catch (error: any) {
      console.error('Error creating escrow:', error);
      
      // If this was an x402 payment, make sure we don't fall through to SOL
      if (String(paymentCurrency).toUpperCase() === 'X402') {
        console.error('x402 payment failed');
        toast({
          title: "x402 Payment Failed",
          description: error?.message || "x402 payment failed. Please try again or use a different payment method.",
          variant: "destructive",
        });
        setIsLoading(false);
        return null;
      }
      
      toast({
        title: "Escrow Creation Failed",
        description: error?.message || "Failed to create escrow. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return null;
    }
  }, [provider, address, toast]);

  const fundEscrow = useCallback(async (
    escrowId: string, 
    amount: number,
    paymentCurrency: PaymentCurrency = 'SOLANA'
  ): Promise<boolean> => {
    // Rate limiting check
    if (!canFundEscrow()) {
      return false;
    }

    const w: any = window as any;
    const ph = w.solana;
    if (!ph?.isPhantom) {
      toast({
        title: "Phantom required",
        description: "Please connect your Phantom (Solana) wallet to fund escrow",
        variant: "destructive",
      });
      return false;
    }
    if (!ph.isConnected) {
      try { await ph.connect(); } catch {
        toast({ title: "Wallet not connected", description: "Phantom connection was rejected", variant: "destructive" });
        return false;
      }
    }
    const solAddress: string | undefined = ph.publicKey?.toString?.();
    if (!solAddress) {
      toast({ title: "Wallet error", description: "Could not read Phantom public key", variant: "destructive" });
      return false;
    }

    setIsLoading(true);
    try {
      const escrow = await db.getEscrowById(escrowId);
      if (!escrow.escrow_account) {
        throw new Error('Escrow account not found');
      }

      const clientWallet = new PublicKey(solAddress);
      const escrowAccount = new PublicKey(escrow.escrow_account);

      // Create funding transaction without any conversion
      const transaction = await fundEscrowWithCurrency(
        clientWallet, 
        escrowAccount, 
        amount, 
        paymentCurrency
      );

      // Get the latest blockhash (with fallback RPCs if official RPC is rate-limited)
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithFallback();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Use the same pattern as x402 payments: signTransaction + sendRawTransactionViaProxy
      // This avoids Phantom security warnings that can occur with signAndSendTransaction
      // for certain transaction patterns (like token account creation + transfer)
      const signedTransaction = await ph.signTransaction(transaction);
      
      // Serialize immediately after signing
      const serializedTransaction = signedTransaction.serialize();
      
      // Send via backend proxy (same as x402 payments)
      // This is more reliable and avoids Phantom security warnings
      const { sendRawTransactionViaProxy } = await import('@/lib/solana');
      const signature = await sendRawTransactionViaProxy(serializedTransaction);

      // Update escrow status in database
      await db.updateEscrow(escrowId, {
        status: 'funded',
        funded_at: new Date().toISOString(),
        transaction_signature: signature
      });

      toast({
        title: "Escrow Funded",
        description: paymentCurrency === 'USDC' 
          ? `Successfully funded escrow with ${amount} USDC`
          : `Successfully funded escrow with ${formatSOL(amount)}`,
      });

      return true;
    } catch (error) {
      console.error('Error funding escrow:', error);
      toast({
        title: "Funding Failed",
        description: "Failed to fund escrow. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider, address, toast]);

  const releasePayment = useCallback(async (
    escrowId: string, 
    milestoneId: string
  ): Promise<boolean> => {
    // Rate limiting check
    if (!canReleasePayment()) {
      return false;
    }

    const w: any = window as any;
    const ph = w.solana;
    if (!ph?.isPhantom) {
      toast({
        title: "Phantom required",
        description: "Please connect your Phantom (Solana) wallet to release payment",
        variant: "destructive",
      });
      return false;
    }
    if (!ph.isConnected) {
      try { await ph.connect(); } catch {
        toast({ title: "Wallet not connected", description: "Phantom connection was rejected", variant: "destructive" });
        return false;
      }
    }
    const solAddress: string | undefined = ph.publicKey?.toString?.();
    if (!solAddress) {
      toast({ title: "Wallet error", description: "Could not read Phantom public key", variant: "destructive" });
      return false;
    }

    setIsLoading(true);
    try {
      const escrow = await db.getEscrowById(escrowId);
      const milestone = await db.getMilestones(escrow.project_id);
      const targetMilestone = milestone.find(m => m.id === milestoneId);

      if (!escrow.escrow_account || !escrow.freelancer_wallet || !targetMilestone) {
        throw new Error('Required escrow data not found');
      }

      const clientWallet = new PublicKey(solAddress);
      const freelancerWallet = new PublicKey(escrow.freelancer_wallet);
      const escrowAccount = new PublicKey(escrow.escrow_account);

      // Create payment release transaction (always in internal token)
      const transaction = await releaseEscrowPayment(
        clientWallet,
        freelancerWallet,
        escrowAccount,
        targetMilestone.amount_usdc,
        'SOLANA'
      );

      // Get the latest blockhash (with fallback RPCs if official RPC is rate-limited)
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithFallback();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Sign and send with Phantom
      const res = await ph.signAndSendTransaction(transaction);
      const signature = typeof res === 'string' ? res : res?.signature;
      if (!signature) throw new Error('No signature returned from wallet');
      
      // Don't wait for confirmation - Phantom handles it and WebSocket connections are blocked
      // The transaction is already confirmed when signAndSendTransaction returns
      // We can verify it later if needed, but don't block here

      // Update milestone and escrow status
      await db.updateMilestone(milestoneId, {
        status: 'approved',
        approved_at: new Date().toISOString()
      });

      // Check if all milestones are completed
      const allMilestones = await db.getMilestones(escrow.project_id);
      const allCompleted = allMilestones.every(m => m.status === 'approved');

      if (allCompleted) {
        await db.updateEscrow(escrowId, {
          status: 'released',
          released_at: new Date().toISOString()
        });
      }

      toast({
        title: "Payment Released",
        description: `Successfully released ${formatSOL(targetMilestone.amount_usdc)} to freelancer`,
      });

      return true;
    } catch (error) {
      console.error('Error releasing payment:', error);
      toast({
        title: "Release Failed",
        description: "Failed to release payment. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [provider, address, toast]);

  const releasePaymentToFreelancer = useCallback(async (
    escrowId: string,
    freelancerWallet: string
  ): Promise<boolean> => {
    // Rate limiting check
    if (!canReleasePayment()) {
      return false;
    }

    setIsLoading(true);
    try {
      const escrow = await db.getEscrowById(escrowId);
      
      if (!escrow) {
        throw new Error('Escrow not found');
      }

      // For x402 payments, escrow_account might be null (payment goes to platform wallet)
      // The platform wallet is the escrow for x402, so we can proceed without escrow_account
      // For SOL/USDC, escrow_account should exist
      const paymentCurrency = (escrow.payment_currency as PaymentCurrency) || 'SOLANA';
      if (paymentCurrency !== 'USDC' && paymentCurrency !== 'X402' && !escrow.escrow_account) {
        throw new Error('Escrow account not found');
      }

      // Security: Prevent duplicate payments
      if (escrow.status === 'released') {
        throw new Error('Payment has already been released for this escrow');
      }

      if (escrow.status !== 'funded') {
        throw new Error(`Escrow is not in funded state. Current status: ${escrow.status}`);
      }

      // Security: Verify caller is authorized (project owner)
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const project = await db.getProject(escrow.project_id);
      if (project.client_id !== address) {
        throw new Error('Unauthorized: Only the project owner can release payment');
      }

      // Security: Verify project is in valid state for completion
      if (project.status !== 'in_progress') {
        throw new Error(`Project must be in progress to complete. Current status: ${project.status}`);
      }
      
      // Amount to send to freelancer (project amount, excluding platform fee)
      const amountToSend = escrow.amount_usdc;
      
      // Use secure backend API instead of direct blockchain access
      // signMessage will trigger Phantom popup for signature
      const signature = await releasePaymentAPI(
        escrowId,
        freelancerWallet,
        address,
        signMessage
      );

      toast({
        title: "Payment Released",
        description: paymentCurrency === 'USDC' 
          ? `Successfully sent ${formatUSDC(amountToSend)} to freelancer`
          : `Successfully sent ${formatSOL(amountToSend)} to freelancer`,
      });

      return true;
    } catch (error) {
      console.error('Error releasing payment to freelancer:', error);
      toast({
        title: "Payment Release Failed",
        description: error instanceof Error ? error.message : "Failed to release payment. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast, address, signMessage]);

  return {
    createProjectEscrow,
    fundEscrow,
    releasePayment,
    releasePaymentToFreelancer,
    isLoading
  };
};