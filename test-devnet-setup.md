# Devnet Testing Setup Guide

## Step 1: Switch Phantom Wallet to Devnet

1. Open Phantom browser extension
2. Click the settings gear icon
3. Go to **Developer Mode** → Enable it
4. Go to **Network** → Select **Devnet**
5. Your wallet address will remain the same, but transactions will be on devnet

## Step 2: Get Free Devnet SOL

Visit one of these faucets and paste your Phantom wallet address:

- **Solana Faucet**: https://faucet.solana.com/
- **Solfaucet**: https://solfaucet.com/ (select Devnet)
- Request 2 SOL (this is free test money, not real)

## Step 3: Get Devnet USDC (Optional - for USDC testing)

Since we're testing with devnet USDC, you'll need to:
1. Make sure your Phantom wallet has devnet SOL for transaction fees
2. The devnet USDC mint is: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`
3. You may need to create a USDC token account if testing USDC payments

Alternatively, you can primarily test with SOL on devnet (which is easier).

## Step 4: Fund Your Escrow Wallet (Devnet)

Your escrow wallet address: **AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U**

To test receiving funds:
1. Get devnet SOL to this address from the faucet
2. Or transfer some from your Phantom wallet

## Step 5: Verify Network Configuration

The app automatically uses:
- **Devnet** when running `npm run dev` (development mode)
- **Mainnet** when running `npm run build` (production mode)

## Testing Checklist

- [ ] Phantom switched to Devnet network
- [ ] Received devnet SOL in Phantom wallet
- [ ] App running in development mode (`npm run dev`)
- [ ] Create a test project with SOL payment
- [ ] Verify escrow funds arrive in escrow wallet
- [ ] Check Supabase database for escrow record

## Notes

- All transactions on devnet are **free and fake** - no real money involved
- Devnet resets periodically, so you may need to re-faucet SOL
- The escrow wallet (`AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U`) works on both devnet and mainnet (same keypair)
- To switch to mainnet later, change the build mode or MODE environment variable

