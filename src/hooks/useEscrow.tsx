import { useState, useCallback } from 'react';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { useWallet } from './useWallet';
import { createEscrowAccount, fundEscrowWithCurrency, releaseEscrowPayment, connection, PaymentCurrency, formatSOL, formatUSDC } from '@/lib/solana';
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
  const { provider, address, isConnected, signMessage } = useWallet();
  const { toast } = useToast();

  const createProjectEscrow = useCallback(async (
    projectId: string, 
    amount: number,
    paymentCurrency: PaymentCurrency = 'SOLANA'
  ): Promise<string | null> => {

    // Use wallet connection from our hook to avoid re-connection prompts
    if (!isConnected || !address || !provider) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first using the Connect Wallet button",
        variant: "destructive",
      });
      return null;
    }

    // Use the provider directly from our hook to maintain connection context
    // This helps maintain popup mode instead of triggering fullscreen
    const ph = provider as any;
    if (!ph?.isPhantom) {
      toast({
        title: "Phantom required",
        description: "Please connect your Phantom (Solana) wallet to create escrow",
        variant: "destructive",
      });
      return null;
    }
    
    // Use the address from our wallet hook (already connected)
    const solAddress = address;

    setIsLoading(true);
    try {
      const clientWallet = new PublicKey(solAddress);
      const platformFeePercent = 10; // 10% platform fee
      
      let finalAmount = amount;
      let actualCurrency: PaymentCurrency = paymentCurrency;
      
      const platformFee = (finalAmount * platformFeePercent) / 100;
      const totalLocked = finalAmount + platformFee;

      // Create and fund escrow account on Solana with selected currency
      const { escrowAccount, transaction } = await createEscrowAccount(
        clientWallet,
        projectId,
        finalAmount,
        actualCurrency,
        platformFeePercent
      );

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Use signAndSendTransaction - when wallet is already connected via our hook provider,
      // this should maintain popup context instead of fullscreen
      const result = await ph.signAndSendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      const signature = typeof result === 'string' ? result : result?.signature;
      if (!signature) throw new Error('No signature returned from wallet');
      
      // Confirm transaction
      await connection.confirmTransaction(signature, 'confirmed');

      // Store escrow in database with payment currency
      const escrow = await db.createEscrow({
        project_id: projectId,
        client_wallet: solAddress,
        amount_usdc: finalAmount, // Internal accounting amount
        platform_fee: platformFee,
        total_locked: totalLocked,
        escrow_account: escrowAccount.toString(),
        transaction_signature: signature,
        status: 'funded',
        payment_currency: actualCurrency
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
  }, [isConnected, address, provider, toast]);

  const fundEscrow = useCallback(async (
    escrowId: string, 
    amount: number,
    paymentCurrency: PaymentCurrency = 'SOLANA'
  ): Promise<boolean> => {
    // Use wallet connection from our hook
    if (!isConnected || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
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
    
    const solAddress = address;

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

      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Sign transaction first (uses popup mode when wallet is connected)
      const signedTransaction = await ph.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(), 
        { skipPreflight: false, maxRetries: 3 }
      );
      
      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

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
    // Use wallet connection from our hook
    if (!isConnected || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
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
    
    const solAddress = address;

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

      // Get the latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Sign transaction first (uses popup mode when wallet is connected)
      const signedTransaction = await ph.signTransaction(transaction);
      
      // Send the signed transaction
      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(), 
        { skipPreflight: false, maxRetries: 3 }
      );
      
      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');

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
  }, [isConnected, address, provider, toast]);

  const releasePaymentToFreelancer = useCallback(async (
    escrowId: string,
    freelancerWallet: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Security: Verify wallet is connected first
      if (!isConnected || !address || !signMessage) {
        toast({
          title: "Wallet not connected",
          description: "Please connect your wallet to release payment",
          variant: "destructive",
        });
        return false;
      }

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

      // Security: Verify escrow hasn't already been released (check transaction signature)
      if (escrow.transaction_signature) {
        // Check if this is a new release attempt (could be retry of failed completion)
        // For now, allow if status is still 'funded' but log warning
        console.warn('Escrow has existing transaction signature but status is still funded');
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
  }, [toast, address, signMessage, isConnected]);

  return {
    createProjectEscrow,
    fundEscrow,
    releasePayment,
    releasePaymentToFreelancer,
    isLoading
  };
};