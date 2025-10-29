import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from './useWallet';
import { createEscrowAccount, fundEscrowWithCurrency, releaseEscrowPayment, connection, PaymentCurrency, formatSOL } from '@/lib/solana';
import { db } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface UseEscrowReturn {
  createProjectEscrow: (projectId: string, amount: number, paymentCurrency: PaymentCurrency) => Promise<string | null>;
  fundEscrow: (escrowId: string, amount: number, paymentCurrency: PaymentCurrency) => Promise<boolean>;
  releasePayment: (escrowId: string, milestoneId: string) => Promise<boolean>;
  isLoading: boolean;
}

export const useEscrow = (): UseEscrowReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const { provider, address } = useWallet();
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
      
      let finalAmount = amount;
      let actualCurrency: PaymentCurrency = paymentCurrency;
      
      const platformFee = (finalAmount * platformFeePercent) / 100;
      const totalLocked = finalAmount + platformFee;

      // Create escrow account on Solana (internally using single token)
      const { escrowAccount, transaction } = await createEscrowAccount(
        clientWallet,
        projectId,
        finalAmount,
        'SOLANA',
        platformFeePercent
      );

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Sign and send with Phantom
      const res = await ph.signAndSendTransaction(transaction);
      const signature = typeof res === 'string' ? res : res?.signature;
      if (!signature) throw new Error('No signature returned from wallet');
      await connection.confirmTransaction(signature);

      // Store escrow in database
      const escrow = await db.createEscrow({
        project_id: projectId,
        client_wallet: solAddress,
        amount_usdc: finalAmount, // Internal accounting amount
        platform_fee: platformFee,
        total_locked: totalLocked,
        escrow_account: escrowAccount.toString(),
        transaction_signature: signature,
        status: 'funded'
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

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Sign and send with Phantom
      const res = await ph.signAndSendTransaction(transaction);
      const signature = typeof res === 'string' ? res : res?.signature;
      if (!signature) throw new Error('No signature returned from wallet');
      await connection.confirmTransaction(signature);

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

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Sign and send with Phantom
      const res = await ph.signAndSendTransaction(transaction);
      const signature = typeof res === 'string' ? res : res?.signature;
      if (!signature) throw new Error('No signature returned from wallet');
      await connection.confirmTransaction(signature);

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

  return {
    createProjectEscrow,
    fundEscrow,
    releasePayment,
    isLoading
  };
};