# Mainnet Readiness Checklist

## ✅ Current Configuration

Your codebase is already configured to work on mainnet when deployed to production:

### Frontend (`src/lib/solana.ts`)
- ✅ Network selection: `MODE === 'production'` → `mainnet-beta`
- ✅ USDC mint: Mainnet USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`)
- ✅ RPC endpoint: `https://api.mainnet-beta.solana.com`

### Backend (`server/services/payment-service.ts`)
- ✅ Network selection: `NODE_ENV === 'production'` → `mainnet-beta`
- ✅ USDC mint: Mainnet USDC (correct)
- ✅ RPC endpoint: Uses `SOLANA_MAINNET_RPC` env var or defaults to public RPC

### Platform Wallet
- ✅ Wallet address: `AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U`
- ✅ Private key stored securely in backend environment variables

## ⚠️ Critical Requirements for Mainnet

### 1. **Platform Wallet Funding** (REQUIRED)
The platform wallet `AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U` must:
- ✅ Exist on Solana mainnet (same private key = same address)
- ❓ **Have sufficient SOL balance** for transaction fees
- ❓ **Have USDC balance** if clients will pay with USDC (recommended: keep some for creating token accounts)

**Action Required:**
```bash
# Send some SOL to the platform wallet for fees (recommend 1-5 SOL)
# You can check balance at: https://solscan.io/account/AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U
```

### 2. **Vercel Environment Variables** (REQUIRED)
Ensure both frontend and backend have correct environment variables:

#### Frontend Project (`lancerfi.app`)
```env
VITE_API_URL=https://lancerfi-backend.vercel.app
VITE_SUPABASE_URL=https://xhxcfyosctbvlvewyptf.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

#### Backend Project (`lancerfi-backend`)
```env
NODE_ENV=production
FRONTEND_URL=https://lancerfi.app
PLATFORM_WALLET_PRIVATE_KEY=[your_private_key_array]
SUPABASE_URL=https://xhxcfyosctbvlvewyptf.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com
# OR use a paid RPC for better reliability:
# SOLANA_MAINNET_RPC=https://your-paid-rpc-endpoint.com
```

### 3. **RPC Endpoint Recommendation** (OPTIONAL but RECOMMENDED)
The public Solana RPC (`https://api.mainnet-beta.solana.com`) has rate limits. For production, consider:
- **Helius** (free tier available): https://www.helius.dev/
- **QuickNode**: https://www.quicknode.com/
- **Alchemy**: https://www.alchemy.com/

Set `SOLANA_MAINNET_RPC` in backend environment variables.

### 4. **Testing on Mainnet** (BEFORE GOING LIVE)
1. ✅ Deploy to Vercel with production environment variables
2. ✅ Connect Phantom wallet set to **Mainnet** (not Devnet!)
3. ✅ Create a small test project ($10-20)
4. ✅ Complete the payment flow
5. ✅ Verify funds are received correctly

## 🔍 Network Detection Flow

### During Development:
- Frontend: `MODE=development` → Devnet
- Backend: `NODE_ENV=development` → Devnet
- Phantom: User must set wallet to Devnet

### In Production (Vercel):
- Frontend: `MODE=production` (automatically set by Vite build) → Mainnet
- Backend: `NODE_ENV=production` (from Vercel env vars) → Mainnet
- Phantom: User must set wallet to Mainnet

## 🚨 Important Notes

1. **Wallet Network Mismatch**: If Phantom is on Devnet but the app is in production mode, transactions will fail. Users must match their Phantom network to the app's network.

2. **No Automatic Network Switching**: The app doesn't automatically switch Phantom's network. Users must manually switch in Phantom settings.

3. **Platform Fee**: The 10% platform fee is retained in the platform wallet on mainnet. Make sure to regularly transfer these funds to your main treasury wallet for security.

4. **Transaction Fees**: All Solana transactions require SOL for fees. Ensure the platform wallet always has sufficient SOL balance (minimum 0.1 SOL recommended).

## ✅ Verification Steps

Before going live on mainnet, verify:

1. [ ] Platform wallet has SOL balance on mainnet
2. [ ] Platform wallet has USDC balance (optional but recommended)
3. [ ] Vercel environment variables are set correctly
4. [ ] Frontend builds with `MODE=production`
5. [ ] Backend has `NODE_ENV=production`
6. [ ] Test with a small amount first
7. [ ] Verify payment release works correctly
8. [ ] Check transaction signatures on Solscan

## 🎯 What Works Now

- ✅ Network detection (devnet vs mainnet)
- ✅ USDC token mint addresses (correct for both networks)
- ✅ Payment currency support (SOL and USDC)
- ✅ Escrow creation and funding
- ✅ Payment release to freelancers
- ✅ Platform fee calculation
- ✅ Backend security (private key stored securely)

The system is **ready for mainnet** once the platform wallet is funded and environment variables are set correctly in Vercel!

