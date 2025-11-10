import { Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { releasePaymentFromPlatform, getPlatformWalletAddress, connection, USDC_MINT } from '../services/payment-service.js';
import { supabaseClient } from '../services/supabase.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

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

    // Security: Verify caller is project owner
    const project = escrow.projects as any;
    if (!project || project.client_id !== walletAddress) {
      return res.status(403).json({
        error: 'Unauthorized: Only the project owner can release payment'
      });
    }

    // Security: Verify project is in valid state
    if (project.status !== 'in_progress') {
      return res.status(400).json({
        error: `Project must be in progress to complete. Current status: ${project.status}`
      });
    }

    // Security: Verify freelancer wallet matches project freelancer
    if (project.freelancer_id) {
      const { data: freelancerProfile } = await supabaseClient
        .from('profiles')
        .select('wallet_address')
        .eq('id', project.freelancer_id)
        .single();

      if (freelancerProfile?.wallet_address !== freelancerWallet) {
        return res.status(400).json({
          error: 'Freelancer wallet address does not match project freelancer'
        });
      }
    }

    // Get payment currency from escrow
    // For x402 payments, payment_currency is 'USDC' but we need to use 'USDC' for the release
    let paymentCurrency = escrow.payment_currency || 'SOLANA';
    
    console.log(`[RELEASE HANDLER] Escrow payment_currency: ${paymentCurrency}, amount_usdc: ${escrow.amount_usdc}`);
    
    // x402 payments use USDC, so if payment_currency is 'X402' or 'USDC', use 'USDC'
    if (paymentCurrency === 'X402' || paymentCurrency === 'USDC') {
      paymentCurrency = 'USDC';
      console.log(`[RELEASE HANDLER] Converted to USDC for release`);
    }
    
    const amountToSend = escrow.amount_usdc;
    
    console.log(`[RELEASE HANDLER] Calling releasePaymentFromPlatform with:`, {
      freelancerWallet,
      amount: amountToSend,
      currency: paymentCurrency
    });
    console.error(`[RELEASE HANDLER] About to call releasePaymentFromPlatform - this should appear`);
    console.log(`[RELEASE HANDLER] About to call releasePaymentFromPlatform - this should also appear`);
    console.error(`[RELEASE HANDLER] paymentCurrency value: ${paymentCurrency}, checking condition...`);

    // CRITICAL: Check if source account exists BEFORE calling releasePaymentFromPlatform
    // The "invalid account data" error means the source account doesn't exist or is invalid
    console.error(`[RELEASE HANDLER] About to check if paymentCurrency is USDC or X402: ${paymentCurrency === 'USDC' || paymentCurrency === 'X402'}`);
    if (paymentCurrency === 'USDC' || paymentCurrency === 'X402') {
      console.error(`[RELEASE HANDLER] Condition met! Starting handler check...`);
      try {
        const platformWallet = getPlatformWalletAddress();
        const platformWalletPubkey = new PublicKey(platformWallet);
        const sourceTokenAccount = await getAssociatedTokenAddress(USDC_MINT, platformWalletPubkey);
        
        console.error(`[HANDLER CHECK] Platform wallet: ${platformWallet}`);
        console.error(`[HANDLER CHECK] Source token account: ${sourceTokenAccount.toString()}`);
        
        // Check if account exists - if not, return error immediately
        const accountInfo = await connection.getAccountInfo(sourceTokenAccount);
        console.error(`[HANDLER CHECK] Account exists: ${accountInfo !== null}`);
        
        if (!accountInfo) {
          console.error(`[HANDLER CHECK] Account does not exist!`);
          return res.status(500).json({
            error: `Platform wallet USDC token account does not exist at ${sourceTokenAccount.toString()}. The x402 payment was not received. Please verify the payment transaction was successful.`
          });
        }
        
        // Verify it's a token account
        console.error(`[HANDLER CHECK] Account owner: ${accountInfo.owner.toString()}, Expected: ${TOKEN_PROGRAM_ID.toString()}`);
        if (accountInfo.owner.toString() !== TOKEN_PROGRAM_ID.toString()) {
          console.error(`[HANDLER CHECK] Account is not a token account!`);
          return res.status(500).json({
            error: `Platform wallet account at ${sourceTokenAccount.toString()} is not a valid token account. Owner: ${accountInfo.owner.toString()}`
          });
        }
        
        // Get account details to verify balance
        const { getAccount } = await import('@solana/spl-token');
        const sourceAccount = await getAccount(connection, sourceTokenAccount);
        const balanceUSDC = Number(sourceAccount.amount) / Math.pow(10, 6);
        
        console.error(`[HANDLER CHECK] Account balance: ${balanceUSDC} USDC, Required: ${amountToSend}`);
        console.error(`[HANDLER CHECK] Account mint: ${sourceAccount.mint.toString()}, Expected: ${USDC_MINT.toString()}`);
        console.error(`[HANDLER CHECK] Account owner: ${sourceAccount.owner.toString()}, Expected: ${platformWallet}`);
        
        if (balanceUSDC < amountToSend) {
          console.error(`[HANDLER CHECK] Insufficient balance!`);
          return res.status(500).json({
            error: `Insufficient USDC in platform wallet. Available: ${balanceUSDC}, Required: ${amountToSend}`
          });
        }
        
        console.error(`[HANDLER CHECK] All checks passed, proceeding to releasePaymentFromPlatform`);
      } catch (checkError: any) {
        // If check fails, return error immediately - don't continue
        console.error(`[HANDLER CHECK] Error during check: ${checkError.message}`);
        console.error(`[HANDLER CHECK] Error stack: ${checkError.stack}`);
        return res.status(500).json({
          error: `Failed to verify platform wallet USDC account: ${checkError.message || 'Unknown error'}`
        });
      }
    }

    // Release payment from platform wallet
    try {
      console.error(`[RELEASE HANDLER] Inside try block, calling releasePaymentFromPlatform now`);
      const signature = await releasePaymentFromPlatform(
        new PublicKey(freelancerWallet),
        amountToSend,
        paymentCurrency as 'USDC' | 'SOLANA'
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
    } catch (releaseError: any) {
      console.error(`[RELEASE HANDLER] Error in releasePaymentFromPlatform:`, {
        errorName: releaseError.name,
        errorMessage: releaseError.message,
        errorStack: releaseError.stack,
        transactionMessage: releaseError.transactionMessage,
        transactionLogs: releaseError.transactionLogs
      });
      throw releaseError;
    }

  } catch (error) {
    console.error('Error in releasePaymentHandler:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to release payment'
    });
  }
}

