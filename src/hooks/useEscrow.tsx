import { useState, useCallback } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import { useWallet } from './useWallet';
import { createEscrowAccount, fundEscrowWithUSDC, releaseEscrowPayment, connection } from '@/lib/solana';
import { db } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface UseEscrowReturn {
  createProjectEscrow: (projectId: string, amount: number) => Promise<string | null>;
  fundEscrow: (escrowId: string, amount: number) => Promise<boolean>;
  releasePayment: (escrowId: string, milestoneId: string) => Promise<boolean>;
  isLoading: boolean;
}

export const useEscrow = (): UseEscrowReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const { provider, address } = useWallet();
  const { toast } = useToast();

  const createProjectEscrow = useCallback(async (
    projectId: string, 
    amount: number
  ): Promise<string | null> => {
    if (!provider || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create escrow",
        variant: "destructive",
      });
      return null;
    }

    setIsLoading(true);
    try {
      const clientWallet = new PublicKey(address);
      const platformFeePercent = 10; // 10% platform fee
      const platformFee = (amount * platformFeePercent) / 100;
      const totalLocked = amount + platformFee;

      // Create escrow account on Solana
      const { escrowAccount, transaction } = await createEscrowAccount(
        clientWallet,
        projectId,
        amount,
        platformFeePercent
      );

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Sign and send transaction through wallet adapter
      // Note: In production, use Solana wallet adapter instead of ethers
      const signature = await connection.sendTransaction(transaction, []);
      await connection.confirmTransaction(signature);

      // Store escrow in database
      const escrow = await db.createEscrow({
        project_id: projectId,
        client_wallet: address,
        amount_usdc: amount,
        platform_fee: platformFee,
        total_locked: totalLocked,
        escrow_account: escrowAccount.toString(),
        transaction_signature: signature,
        status: 'funded'
      });

      toast({
        title: "Escrow Created",
        description: `Successfully locked ${amount} USDC in smart contract escrow`,
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
    amount: number
  ): Promise<boolean> => {
    if (!provider || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to fund escrow",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    try {
      const escrow = await db.getEscrow(escrowId);
      if (!escrow.escrow_account) {
        throw new Error('Escrow account not found');
      }

      const clientWallet = new PublicKey(address);
      const escrowAccount = new PublicKey(escrow.escrow_account);

      // Create USDC transfer transaction
      const transaction = await fundEscrowWithUSDC(clientWallet, escrowAccount, amount);

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Sign and send transaction
      // Note: In production, use Solana wallet adapter
      const signature = await connection.sendTransaction(transaction, []);
      await connection.confirmTransaction(signature);

      // Update escrow status in database
      await db.updateEscrow(escrowId, {
        status: 'funded',
        funded_at: new Date().toISOString(),
        transaction_signature: signature
      });

      toast({
        title: "Escrow Funded",
        description: `Successfully funded escrow with ${amount} USDC`,
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
    if (!provider || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to release payment",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    try {
      const escrow = await db.getEscrow(escrowId);
      const milestone = await db.getMilestones(escrow.project_id);
      const targetMilestone = milestone.find(m => m.id === milestoneId);

      if (!escrow.escrow_account || !escrow.freelancer_wallet || !targetMilestone) {
        throw new Error('Required escrow data not found');
      }

      const clientWallet = new PublicKey(address);
      const freelancerWallet = new PublicKey(escrow.freelancer_wallet);
      const escrowAccount = new PublicKey(escrow.escrow_account);

      // Create payment release transaction
      const transaction = await releaseEscrowPayment(
        clientWallet,
        freelancerWallet,
        escrowAccount,
        targetMilestone.amount_usdc
      );

      // Get the latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = clientWallet;

      // Sign and send transaction
      // Note: In production, use Solana wallet adapter
      const signature = await connection.sendTransaction(transaction, []);
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
        description: `Successfully released ${targetMilestone.amount_usdc} USDC to freelancer`,
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