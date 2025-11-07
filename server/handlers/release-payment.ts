import { Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { releasePaymentFromPlatform } from '../services/payment-service.js';
import { supabaseClient } from '../services/supabase.js';

interface AuthenticatedRequest {
  walletAddress?: string;
  body: {
    escrowId: string;
    freelancerWallet: string;
  };
}

/**
 * Handle payment release request
 * Verifies authorization and releases payment to freelancer
 */
export async function releasePaymentHandler(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const { escrowId, freelancerWallet } = req.body;
    const walletAddress = req.walletAddress;

    if (!walletAddress) {
      return res.status(401).json({ error: 'Wallet address not authenticated' });
    }

    if (!escrowId || !freelancerWallet) {
      return res.status(400).json({
        error: 'Missing required fields: escrowId, freelancerWallet'
      });
    }

    // Get escrow from database
    const { data: escrow, error: escrowError } = await supabaseClient
      .from('escrows')
      .select('*, projects(client_id, status, freelancer_id)')
      .eq('id', escrowId)
      .single();

    if (escrowError || !escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }

    // Security: Verify escrow hasn't already been released
    if (escrow.status === 'released') {
      return res.status(400).json({
        error: 'Payment has already been released for this escrow'
      });
    }

    // Security: Verify escrow is in funded state
    if (escrow.status !== 'funded') {
      return res.status(400).json({
        error: `Escrow is not in funded state. Current status: ${escrow.status}`
      });
    }

    // Security: Verify caller is project owner or freelancer (when work is approved)
    const project = escrow.projects as any;
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isProjectOwner = project.client_id === walletAddress;
    let isFreelancer = false;
    let freelancerProfile: any = null;

    // Security: Verify freelancer wallet matches project freelancer
    if (project.freelancer_id) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('wallet_address')
        .eq('id', project.freelancer_id)
        .single();

      freelancerProfile = profile;
      if (freelancerProfile?.wallet_address === walletAddress) {
        isFreelancer = true;
      }

      if (freelancerProfile?.wallet_address !== freelancerWallet) {
        return res.status(400).json({
          error: 'Freelancer wallet address does not match project freelancer'
        });
      }
    }

    // If caller is freelancer, verify work is approved
    if (isFreelancer && !isProjectOwner) {
      const { data: workSubmissions } = await supabaseClient
        .from('work_submissions')
        .select('status')
        .eq('project_id', escrow.project_id)
        .eq('status', 'approved')
        .limit(1);

      if (!workSubmissions || workSubmissions.length === 0) {
        return res.status(403).json({
          error: 'Unauthorized: Work must be approved before freelancer can collect payment'
        });
      }
    }

    // If caller is neither project owner nor freelancer, deny access
    if (!isProjectOwner && !isFreelancer) {
      return res.status(403).json({
        error: 'Unauthorized: Only the project owner or assigned freelancer (when work is approved) can release payment'
      });
    }

    // Security: Verify project is in valid state
    if (project.status !== 'in_progress') {
      return res.status(400).json({
        error: `Project must be in progress to complete. Current status: ${project.status}`
      });
    }

    // Get payment currency from escrow
    const paymentCurrency = escrow.payment_currency || 'SOLANA';
    const amountToSend = escrow.amount_usdc;

    // Release payment from platform wallet
    const signature = await releasePaymentFromPlatform(
      new PublicKey(freelancerWallet),
      amountToSend,
      paymentCurrency
    );

    // Update escrow status in database
    const { error: updateError } = await supabaseClient
      .from('escrows')
      .update({
        status: 'released',
        released_at: new Date().toISOString(),
        freelancer_wallet: freelancerWallet,
        transaction_signature: signature
      })
      .eq('id', escrowId);

    if (updateError) {
      console.error('Error updating escrow:', updateError);
      // Payment was sent but database update failed - this is bad but we return success
      // The payment is already on blockchain, so we log the error
      return res.status(500).json({
        error: 'Payment sent successfully but failed to update database. Transaction signature: ' + signature
      });
    }

    // Send notifications to client and freelancer about payment release
    // Note: Project completion notification will be sent from client after project status update
    try {
      // Get project details for notification
      const { data: projectData } = await supabaseClient
        .from('projects')
        .select('title, client_id, freelancer_id')
        .eq('id', escrow.project_id)
        .single();

      if (projectData) {
        const systemSender = 'system@lancerfi.app';
        const currencyDisplay = paymentCurrency === 'USDC' || paymentCurrency === 'X402'
          ? `$${amountToSend.toLocaleString()} ${paymentCurrency}`
          : `${amountToSend.toLocaleString()} SOL`;

        const notifications = [];

        // Notify client that payment has been released
        notifications.push({
          sender_id: systemSender,
          recipient_id: projectData.client_id,
          subject: 'Payment Released',
          content: `Payment of ${currencyDisplay} has been released from escrow and sent to the freelancer for project "${projectData.title}". The project can now be marked as completed.`
        });

        // Notify freelancer that payment has been received
        if (freelancerWallet) {
          notifications.push({
            sender_id: systemSender,
            recipient_id: freelancerWallet,
            subject: 'Payment Received',
            content: `Payment of ${currencyDisplay} has been released from escrow and sent to your wallet for project "${projectData.title}". Thank you for your work!`
          });
        }

        // Insert notifications (non-blocking)
        try {
          const { error } = await supabaseClient
            .from('messages')
            .insert(notifications);
          if (error) {
            console.error('Error sending payment release notifications:', error);
          }
        } catch (err) {
          console.error('Error sending payment release notifications:', err);
          // Don't fail the request if notifications fail
        }
      }
    } catch (notificationError) {
      console.error('Error sending payment release notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.json({
      success: true,
      transactionSignature: signature,
      message: `Successfully released ${paymentCurrency === 'USDC' ? `$${amountToSend} USDC` : `${amountToSend} SOL`} to freelancer`
    });

  } catch (error) {
    console.error('Error in releasePaymentHandler:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to release payment'
    });
  }
}

