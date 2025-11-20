import { Response } from 'express';
import { PublicKey } from '@solana/web3.js';
import { releasePaymentFromPlatform, releaseX402PaymentFromPlatform, getPlatformWalletAddress, connection, USDC_MINT } from '../services/payment-service.js';
import { supabaseClient } from '../services/supabase.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface AuthenticatedRequest {
  walletAddress?: string;
  body: {
    escrowId: string;
    freelancerWallet: string;
    freelancerEVMAddress?: string; // Optional EVM address for X402 payments
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
    const { escrowId, freelancerWallet, freelancerEVMAddress } = req.body;
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

    // Get payment currency from escrow
    const paymentCurrency = escrow.payment_currency || 'SOLANA';
    const isX402 = paymentCurrency === 'X402';
    
    const amountToSend = escrow.amount_usdc;
    
    // For X402 payments, use Base network release (EVM)
    if (isX402) {
      // For X402, we need EVM address. Check if freelancer wallet is already EVM format
      let freelancerEVMAddress: string;
      
      // If freelancer wallet is Solana format, we need to get the EVM address
      if (!freelancerWallet.startsWith('0x') || freelancerWallet.length !== 42) {
        // Check if EVM address was provided in the request body
        if (freelancerEVMAddress && freelancerEVMAddress.startsWith('0x') && freelancerEVMAddress.length === 42) {
          // Use the provided EVM address from request body
          freelancerEVMAddress = freelancerEVMAddress;
        } else {
          // Try to get freelancer profile to verify Solana address
          if (project.freelancer_id) {
            const { data: freelancerProfile, error: profileError } = await supabaseClient
              .from('profiles')
              .select('wallet_address')
              .eq('id', project.freelancer_id)
              .maybeSingle();
            
            if (profileError) {
              console.error('Error fetching freelancer profile:', profileError);
              return res.status(500).json({
                error: `Database error while fetching freelancer profile: ${profileError.message}`
              });
            }
            
            if (!freelancerProfile) {
              console.error(`Freelancer profile not found for freelancer_id: ${project.freelancer_id}`);
              return res.status(400).json({
                error: `Freelancer profile not found (ID: ${project.freelancer_id}). The freelancer must have a profile in the system. Please contact the freelancer to ensure their profile is set up correctly.`
              });
            }
            
            // Verify the Solana address matches for authorization (case-insensitive)
            const profileSolanaAddress = freelancerProfile.wallet_address?.toLowerCase().trim();
            const providedSolanaAddress = freelancerWallet.toLowerCase().trim();
            
            if (profileSolanaAddress !== providedSolanaAddress) {
              return res.status(400).json({
                error: 'Freelancer wallet address does not match project freelancer'
              });
            }
          }
          
          // No EVM address provided - return error asking for it
          return res.status(400).json({
            error: 'For X402 payments, freelancer must provide their EVM (Base network) wallet address. Please provide the freelancer\'s EVM address (0x...) when releasing payment.'
          });
        }
      } else {
        // Freelancer wallet is already EVM format - use it directly
        freelancerEVMAddress = freelancerWallet;
      }
      
      // Use the EVM address for payment release
      const freelancerWalletForRelease = freelancerEVMAddress || freelancerWallet;
      
      // Release X402 payment from Base platform wallet
      try {
        const signature = await releaseX402PaymentFromPlatform(
          freelancerWalletForRelease,
          amountToSend
        );
        
        // Update escrow status in database
        const { error: updateError } = await supabaseClient
          .from('escrows')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            freelancer_wallet: freelancerWalletForRelease,
            transaction_signature: signature
          })
          .eq('id', escrowId);

        if (updateError) {
          console.error('Error updating escrow:', updateError);
          return res.status(500).json({
            error: 'Payment sent successfully but failed to update database. Transaction signature: ' + signature
          });
        }

        // Send notifications
        try {
          const { data: projectData } = await supabaseClient
            .from('projects')
            .select('title, client_id, freelancer_id')
            .eq('id', escrow.project_id)
            .single();

          if (projectData) {
            const systemSender = 'system@lancerfi.app';
            const currencyDisplay = `$${amountToSend.toLocaleString()} USDC (Base)`;

            const notifications = [
              {
                sender_id: systemSender,
                recipient_id: projectData.client_id,
                subject: 'Payment Released',
                content: `Payment of ${currencyDisplay} has been released from escrow and sent to the freelancer for project "${projectData.title}". The project can now be marked as completed.`
              },
              {
                sender_id: systemSender,
                recipient_id: freelancerWallet,
                subject: 'Payment Received',
                content: `Payment of ${currencyDisplay} has been released from escrow and sent to your wallet for project "${projectData.title}". Thank you for your work!`
              }
            ];

            await supabaseClient.from('messages').insert(notifications);
          }
        } catch (notificationError) {
          console.error('Error sending payment release notifications:', notificationError);
        }

        return res.json({
          success: true,
          transactionSignature: signature,
          message: `Successfully released $${amountToSend} USDC (Base) to freelancer`
        });
      } catch (releaseError: any) {
        console.error('Error releasing X402 payment:', releaseError);
        return res.status(500).json({
          error: releaseError.message || 'Failed to release X402 payment'
        });
      }
    }
    
    // For SOLANA/USDC (Solana network), use existing Solana release flow
    // x402 payments use USDC, so if payment_currency is 'USDC' (on Solana), use 'USDC'
    let solanaPaymentCurrency: 'USDC' | 'SOLANA' = paymentCurrency === 'USDC' ? 'USDC' : 'SOLANA';
    
    // CRITICAL: Check if source account exists BEFORE calling releasePaymentFromPlatform
    // The "invalid account data" error means the source account doesn't exist or is invalid
    if (solanaPaymentCurrency === 'USDC') {
      try {
        const platformWallet = getPlatformWalletAddress();
        const platformWalletPubkey = new PublicKey(platformWallet);
        const sourceTokenAccount = await getAssociatedTokenAddress(USDC_MINT, platformWalletPubkey);
        
        // Check if account exists - if not, return error immediately
        const accountInfo = await connection.getAccountInfo(sourceTokenAccount);
        
        if (!accountInfo) {
          return res.status(500).json({
            error: 'Platform wallet USDC token account does not exist. The x402 payment may not have been received.'
          });
        }
        
        // Verify it's a token account
        if (accountInfo.owner.toString() !== TOKEN_PROGRAM_ID.toString()) {
          return res.status(500).json({
            error: 'Platform wallet account is not a valid token account'
          });
        }
        
        // Get account details to verify balance
        const { getAccount } = await import('@solana/spl-token');
        const sourceAccount = await getAccount(connection, sourceTokenAccount);
        const balanceUSDC = Number(sourceAccount.amount) / Math.pow(10, 6);
        
        if (balanceUSDC < amountToSend) {
          return res.status(500).json({
            error: 'Insufficient USDC in platform wallet'
          });
        }
      } catch (checkError: any) {
        console.error('Payment release validation failed:', checkError.message);
        return res.status(500).json({
          error: 'Failed to verify platform wallet USDC account'
        });
      }
    }

    // Release payment from platform wallet (Solana network)
    try {
      const signature = await releasePaymentFromPlatform(
        new PublicKey(freelancerWallet),
        amountToSend,
        solanaPaymentCurrency
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
          const currencyDisplay = solanaPaymentCurrency === 'USDC'
            ? `$${amountToSend.toLocaleString()} USDC`
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
        message: `Successfully released ${solanaPaymentCurrency === 'USDC' ? `$${amountToSend} USDC` : `${amountToSend} SOL`} to freelancer`
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

