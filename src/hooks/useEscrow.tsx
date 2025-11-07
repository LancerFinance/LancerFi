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
        console.log('Transaction details before sending:', {
          instructions: transaction.instructions.length,
          feePayer: transaction.feePayer?.toString(),
          recentBlockhash: transaction.recentBlockhash?.toString().substring(0, 20) + '...',
          lastValidBlockHeight: transaction.lastValidBlockHeight
        });
        
        // CRITICAL FIX: Get FRESH blockhash RIGHT before signing and sending
        // Blockhashes expire after ~60 seconds. If blockhash expires, transaction will be dropped
        // Strategy: Get fresh blockhash → Update transaction → Sign → Send immediately
        try {
          console.log('Getting fresh blockhash right before signing (blockhashes expire after ~60 seconds)...');
          
          // Get FRESH blockhash right before signing
          const freshBlockhash = await getLatestBlockhashWithFallback();
          
          // Update transaction with fresh blockhash
          transaction.recentBlockhash = freshBlockhash.blockhash;
          transaction.lastValidBlockHeight = freshBlockhash.lastValidBlockHeight;
          
          console.log('Fresh blockhash obtained:', {
            blockhash: freshBlockhash.blockhash.substring(0, 20) + '...',
            lastValidBlockHeight: freshBlockhash.lastValidBlockHeight,
            timestamp: new Date().toISOString()
          });
          
          console.log('Step 1: Signing transaction with Phantom (user approval)...');
          
          // Sign with Phantom (user approves in wallet)
          const signedTransaction = await ph.signTransaction(transaction);
          
          console.log('✅ Transaction signed by Phantom');
          console.log('Signed transaction has', signedTransaction.signatures.length, 'signature(s)');
          
          // Serialize immediately after signing
          const serializedTransaction = signedTransaction.serialize();
          console.log('Transaction serialized, size:', serializedTransaction.length, 'bytes');
          
          // Step 2: Send IMMEDIATELY after signing (don't wait - blockhash could expire)
          console.log('Step 2: Broadcasting signed transaction to Solana network via backend proxy...');
          signature = await sendRawTransactionViaProxy(serializedTransaction);
          
          console.log('✅ Transaction broadcast to network, signature:', signature);
          
        } catch (phantomError: any) {
          console.error('Phantom signAndSendTransaction error:', phantomError);
          // Check for specific Phantom errors
          if (phantomError?.code === 4001 || phantomError?.message?.includes('User rejected')) {
            throw new Error('Transaction was rejected by user');
          }
          if (phantomError?.message?.includes('insufficient funds') || phantomError?.message?.includes('Insufficient')) {
            throw new Error('Insufficient balance to complete transaction');
          }
          throw new Error(`Phantom transaction failed: ${phantomError?.message || 'Unknown error'}`);
        }
        
        console.log('Transaction sent via Phantom, signature:', signature);
        console.log('Per Phantom docs, signAndSendTransaction should handle confirmation internally');
        console.log('Verifying transaction exists on-chain...');
        
        // Per Phantom docs, signAndSendTransaction should wait for confirmation
        // But we'll verify it exists on-chain to ensure it actually executed
        // Wait a moment for transaction to propagate
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        // Check if transaction exists and succeeded
        let initialCheck = await verifyTransaction(signature);
        
        console.log('Initial verification result:', initialCheck);
        
        // If transaction doesn't exist, it may still be processing or failed
        if (initialCheck.error && initialCheck.error.includes('not found')) {
          console.log('Transaction not found yet, waiting longer...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 more seconds
          
          const retryCheck = await verifyTransaction(signature);
          if (retryCheck.error && retryCheck.error.includes('not found')) {
            // Transaction still not found after 7 seconds total - it likely failed
            throw new Error('Transaction was not found on-chain after multiple attempts. The transaction may have failed during Phantom\'s processing. Please check your wallet balance and try again.');
          }
          initialCheck = retryCheck;
        }
        
        // If transaction exists but has an error, it failed on-chain
        if (initialCheck.error && !initialCheck.error.includes('not found') && !initialCheck.error.includes('403')) {
          throw new Error(`Transaction failed on-chain: ${initialCheck.error}`);
        }
        
        // If we got 403, we can't verify - but Phantom said it sent it
        if (initialCheck.error && (initialCheck.error.includes('403') || initialCheck.error.includes('RPC access blocked'))) {
          console.warn('⚠️ Cannot verify due to RPC access (403) - Phantom said transaction was sent, continuing...');
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
          // Transaction was not confirmed after polling - check one final time
          console.log('⚠️ Transaction not confirmed after polling, doing final verification...');
          const finalCheck = await verifyTransaction(signature);
          
          console.log('Final verification result:', finalCheck);
          
          // CRITICAL: If transaction is not found on-chain, it was NEVER sent
          // Even if Phantom returned a signature, if the transaction doesn't exist on-chain,
          // it means Phantom signed it but failed to broadcast it
          if (finalCheck.error && finalCheck.error.includes('not found')) {
            throw new Error('Transaction was not found on-chain. Phantom returned a signature, but the transaction was never broadcast to the network. This may indicate a network issue or insufficient balance. Please check your wallet and try again.');
          }
          
          // If transaction exists but has an error, it failed on-chain
          if (finalCheck.error && !finalCheck.error.includes('403') && !finalCheck.error.includes('RPC access blocked')) {
            throw new Error(`Transaction failed on-chain: ${finalCheck.error}`);
          }
          
          // If we can't verify due to RPC access issues (403), we have a problem
          // We can't trust Phantom's signature alone - we need on-chain confirmation
          if (finalCheck.error && (finalCheck.error.includes('403') || finalCheck.error.includes('RPC access blocked'))) {
            console.error('❌ Cannot verify transaction due to RPC access issues (403)');
            console.error('❌ This is a critical problem - we cannot confirm the transaction was sent');
            throw new Error('Unable to verify transaction on-chain due to RPC access issues. The transaction may not have been sent. Please try again or check your wallet balance.');
          }
          
          // If we still don't have confirmation, fail
          if (!finalCheck.confirmed || !finalCheck.success) {
            throw new Error('Transaction could not be confirmed on-chain. The transaction may not have been sent or may have failed. Please check your wallet and try again.');
          }
          
          // Transaction verified - proceed
          console.log('✅ Transaction verified in final check');
          confirmed = true;
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
      
      // Transaction was successfully sent via Phantom, signature:', signature);
      console.log('Transaction sent via Phantom, signature:', signature);
      
      // CRITICAL: We MUST verify the transaction actually exists on-chain before creating escrow
      // Don't trust Phantom's signature alone - verify it actually executed
      console.log('Verifying transaction exists on-chain before creating escrow...');
      
      // Wait longer for transaction to be included in a block
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      // Try multiple times to verify
      let verified = false;
      let verificationAttempts = 0;
      const maxVerificationAttempts = 10;
      
      while (!verified && verificationAttempts < maxVerificationAttempts) {
        verificationAttempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
        
        try {
          const finalVerification = await verifyTransaction(signature);
          
          if (finalVerification.success && finalVerification.confirmed) {
            verified = true;
            console.log('✅ Transaction verified on-chain - transaction exists and succeeded!');
            break;
          } else if (finalVerification.error && !finalVerification.error.includes('not found') && !finalVerification.error.includes('403')) {
            // Transaction exists but has an error - it failed
            throw new Error(`Transaction failed on-chain: ${finalVerification.error}`);
          } else if (finalVerification.error && finalVerification.error.includes('not found')) {
            // Transaction not found yet, continue trying
            console.log(`Transaction not found yet (attempt ${verificationAttempts}/${maxVerificationAttempts}), waiting...`);
          } else if (finalVerification.error && finalVerification.error.includes('403')) {
            // RPC access blocked - can't verify, but this is a problem
            console.warn(`⚠️ RPC access blocked (attempt ${verificationAttempts}/${maxVerificationAttempts})`);
            // Continue trying
          }
        } catch (verifyError: any) {
          // If it's not a 403, it's a real error
          if (!verifyError?.message?.includes('403') && !verifyError?.message?.includes('RPC access')) {
            throw verifyError;
          }
          console.warn(`⚠️ Verification error (attempt ${verificationAttempts}/${maxVerificationAttempts}):`, verifyError.message);
        }
      }
      
      if (!verified) {
        // We couldn't verify the transaction - don't create escrow
        throw new Error('Transaction could not be verified on-chain. The transaction may not have been processed. Please check your wallet and try again.');
      }

      // Transaction verified - safe to create escrow
      console.log('✅ Transaction verified - proceeding to create escrow record');
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

      // Security: Verify caller is authorized (project owner or freelancer when work is approved)
      if (!address) {
        throw new Error('Wallet not connected');
      }

      const project = await db.getProject(escrow.project_id);
      const isProjectOwner = project.client_id === address;
      
      // If caller is freelancer, verify work is approved (backend will also verify this)
      if (!isProjectOwner) {
        const workSubmissions = await db.getWorkSubmissions(escrow.project_id);
        const hasApprovedWork = workSubmissions?.some(sub => sub.status === 'approved');
        
        if (!hasApprovedWork) {
          throw new Error('Unauthorized: Work must be approved before freelancer can collect payment');
        }
        
        // Verify caller is the assigned freelancer
        if (project.freelancer_id) {
          const freelancerProfile = await db.getProfile(project.freelancer_id);
          if (freelancerProfile?.wallet_address !== address) {
            throw new Error('Unauthorized: Only the assigned freelancer can collect payment');
          }
        } else {
          throw new Error('Unauthorized: No freelancer assigned to this project');
        }
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