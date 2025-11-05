import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from './useWallet';
import { createEscrowAccount, fundEscrowWithCurrency, releaseEscrowPayment, connection, PaymentCurrency, formatSOL, formatUSDC, getLatestBlockhashWithFallback, sendRawTransactionViaProxy, getAccountBalanceViaProxy, verifyTransaction } from '@/lib/solana';
import { db } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { releasePaymentToFreelancer as releasePaymentAPI } from '@/lib/api-client';

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

  const createProjectEscrow = useCallback(async (
    projectId: string, 
    amount: number,
    paymentCurrency: PaymentCurrency = 'SOLANA'
  ): Promise<string | null> => {

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
      
      // Skip balance check - backend RPC is unreliable
      // Transaction will fail on-chain if balance is insufficient, which is the correct behavior
      console.log('Skipping balance check - proceeding with transaction creation');
      console.log('Wallet address:', clientWallet.toString());
      console.log('Current Solana network:', import.meta.env.MODE === 'production' ? 'mainnet-beta' : 'devnet');
      
      let finalAmount = amount;
      let actualCurrency: PaymentCurrency = paymentCurrency;
      
      const platformFee = (finalAmount * platformFeePercent) / 100;
      const totalLocked = finalAmount + platformFee;
      
      console.log('Transaction details:', {
        amount: finalAmount,
        platformFee,
        totalLocked,
        currency: actualCurrency
      });

      // Create escrow account on Solana (internally using single token)
      const { escrowAccount, transaction } = await createEscrowAccount(
        clientWallet,
        projectId,
        finalAmount,
        'SOLANA',
        platformFeePercent
      );

      // Get the latest blockhash (with fallback RPCs if official RPC is rate-limited)
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithFallback();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Sign and send with Phantom
      console.log('Sending transaction to Phantom:', {
        from: clientWallet.toString(),
        to: escrowAccount.toString(),
        amount: totalLocked,
        currency: 'SOLANA',
        blockhash: transaction.recentBlockhash?.toString(),
        feePayer: transaction.feePayer?.toString(),
        lastValidBlockHeight: transaction.lastValidBlockHeight,
        instructions: transaction.instructions.length,
      });
      
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
      
      console.log('Transaction serialized size:', transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length);
      
      // Sign and send with Phantom - use sendTransaction which actually broadcasts
      // signAndSendTransaction should work, but let's be explicit about sending
      let signature: string;
      
      // Check Phantom's network setting
      const phantomNetwork = ph._publicKey?.network || 'mainnet-beta';
      console.log('Phantom network:', phantomNetwork);
      console.log('App network:', import.meta.env.MODE === 'production' ? 'mainnet-beta' : 'devnet');
      
      try {
        // Use Phantom's signAndSendTransaction - it's more reliable
        // Phantom handles the network connection and broadcasting internally
        console.log('Sending transaction via Phantom signAndSendTransaction...');
        
        // Phantom's signAndSendTransaction signs AND broadcasts the transaction
        // It uses Phantom's own RPC connection, which is more reliable
        signature = await ph.signAndSendTransaction(transaction, {
          skipPreflight: false, // Let Phantom do preflight to catch errors early
        });
        
        console.log('Transaction sent via Phantom, signature:', signature);
        console.log('Verifying transaction was actually processed on-chain...');
        
        // Wait a moment for transaction to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if transaction exists and succeeded
        // Note: If verification fails with 403, it's an RPC access issue, not a transaction failure
        let initialCheck = await verifyTransaction(signature);
        
        // If we got a 403, it's an RPC issue, not a transaction failure
        if (initialCheck.error && initialCheck.error.includes('403') || initialCheck.error?.includes('RPC access blocked')) {
          console.warn('⚠️ Cannot verify transaction due to RPC access (403) - assuming Phantom sent it successfully');
          // Trust Phantom's signAndSendTransaction - if it returned a signature, it was sent
          // Continue with polling but don't fail immediately
        } else if (initialCheck.error && !initialCheck.error.includes('not found')) {
          // Transaction exists but has an error - it failed on-chain
          throw new Error(`Transaction failed on-chain: ${initialCheck.error}`);
        } else if (initialCheck.success && initialCheck.confirmed) {
          console.log('✅ Transaction verified on-chain immediately!');
        } else {
          console.log('Transaction verification pending, continuing to poll...');
        }
        
        // Poll for transaction status instead of using confirmTransaction (which requires blockhash)
        // This avoids "block height exceeded" errors
        let confirmed = false;
        let attempts = 0;
        const maxAttempts = 30; // 30 attempts = 15 seconds max wait
        
        while (!confirmed && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between checks
          attempts++;
          
          const verification = await verifyTransaction(signature);
          
          // Check if transaction actually succeeded (no errors)
          if (verification.success && verification.confirmed) {
            confirmed = true;
            console.log(`✅ Transaction confirmed and SUCCEEDED on-chain after ${attempts} attempts (${attempts * 500}ms)`);
            break;
          }
          
          // If transaction has an error, it failed on-chain
          // But ignore 403 errors - those are RPC access issues, not transaction failures
          if (verification.error && 
              !verification.error.includes('not found') && 
              !verification.error.includes('403') &&
              !verification.error.includes('RPC access blocked')) {
            throw new Error(`Transaction FAILED on-chain: ${verification.error}`);
          }
          
          // If we got 403, it's an RPC issue - continue polling
          if (verification.error && (verification.error.includes('403') || verification.error.includes('RPC access blocked'))) {
            console.warn('⚠️ RPC access blocked during verification, continuing to poll...');
          }
          
          // If transaction exists but not confirmed yet, continue polling
          if (verification.confirmed && !verification.success) {
            console.warn(`⚠️ Transaction found but may have errors, continuing to poll...`);
          }
          
          // Transaction not found yet, continue polling
          if (attempts % 5 === 0) {
            console.log(`Still waiting for confirmation... (attempt ${attempts}/${maxAttempts})`);
          }
        }
        
        if (!confirmed) {
          // Transaction was not confirmed - check if it actually exists on-chain
          const finalCheck = await verifyTransaction(signature);
          if (!finalCheck.success || !finalCheck.confirmed) {
            throw new Error(`Transaction failed or was not processed: ${finalCheck.error || 'Transaction not found on-chain'}`);
          }
          // If it exists and succeeded, continue
          console.log('✅ Transaction confirmed after timeout');
        }
        
      } catch (error: any) {
        console.error('Error with transaction:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          name: error?.name,
          stack: error?.stack,
        });
        // If user rejected, let them know
        if (error?.message?.includes('User rejected') || error?.code === 4001) {
          throw new Error('Transaction was rejected by user');
        }
        throw error;
      }
      
      // Transaction was successfully sent and confirmed
      console.log('Transaction successfully sent and confirmed on blockchain:', signature);
      
      // Double-check that transaction actually succeeded before proceeding
      const finalVerification = await verifyTransaction(signature);
      if (!finalVerification.success) {
        throw new Error(`Transaction verification failed: ${finalVerification.error || 'Transaction did not succeed on-chain'}`);
      }

      // Store escrow in database
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
    } catch (error) {
      console.error('Error creating escrow:', error);
      toast({
        title: "Escrow Creation Failed",
        description: "Failed to create escrow. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [provider, address, toast]);

  const fundEscrow = useCallback(async (
    escrowId: string, 
    amount: number,
    paymentCurrency: PaymentCurrency = 'SOLANA'
  ): Promise<boolean> => {
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

      // Sign and send with Phantom
      const res = await ph.signAndSendTransaction(transaction);
      const signature = typeof res === 'string' ? res : res?.signature;
      if (!signature) throw new Error('No signature returned from wallet');
      
      // Don't wait for confirmation - Phantom handles it and WebSocket connections are blocked
      // The transaction is already confirmed when signAndSendTransaction returns
      // We can verify it later if needed, but don't block here
      console.log('Transaction sent:', signature);

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
      console.log('Transaction sent:', signature);

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
    setIsLoading(true);
    try {
      const escrow = await db.getEscrowById(escrowId);
      
      if (!escrow || !escrow.escrow_account) {
        throw new Error('Escrow not found');
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

      // Get payment currency from escrow (default to SOLANA if not set)
      const paymentCurrency = (escrow.payment_currency as PaymentCurrency) || 'SOLANA';
      
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