# LancerFi

A decentralized freelancing platform built on Solana blockchain with secure escrow payments.

## Features

- **Solana-based Payments**: Pay freelancers with SOL or USDC
- **Escrow System**: Secure payment escrow that locks funds until project completion
- **Wallet Integration**: Connect with Phantom wallet
- **Smart Contracts**: Automatic payment release to freelancers upon project completion
- **Platform Fee**: 10% platform fee automatically deducted and retained

## Tech Stack

### Frontend
- React + TypeScript
- Vite
- Tailwind CSS
- shadcn-ui components
- Solana Web3.js

### Backend
- Node.js + Express
- Solana blockchain integration
- Supabase (PostgreSQL database)

### Infrastructure
- Frontend: Vercel (https://lancerfi.app)
- Backend API: Vercel serverless functions
- Database: Supabase

## Setup

### Prerequisites
- Node.js 18+ and npm
- Phantom wallet browser extension
- Git

### Installation

```sh
# Clone the repository
git clone https://github.com/Powerz98/LancerFi
cd LancerFi

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Environment Variables

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend (server/.env)
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
PLATFORM_WALLET_PRIVATE_KEY=[your_private_key_array]
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run Development Servers

```sh
# Terminal 1: Frontend (runs on http://localhost:8080)
npm run dev

# Terminal 2: Backend (runs on http://localhost:3001)
cd server
npm run dev
```

## Troubleshooting

### Missing Module Errors

If you encounter errors like:
- `Failed to resolve import "dompurify" from "src/lib/input-sanitizer.ts"`
- `Failed to resolve import "bad-words" from "src/lib/profanity-filter.ts"`

**Solution**: Make sure you've installed all dependencies:

```sh
# In the root directory
npm install

# Also install backend dependencies
cd server
npm install
cd ..
```

These errors occur when `node_modules` is missing or incomplete. The `node_modules` folder is not included in the repository (it's gitignored), so you must run `npm install` after cloning the repository.

## Solana Network Configuration

- **Development**: Uses Solana Devnet (for testing)
- **Production**: Uses Solana Mainnet (for real payments)

The network is automatically selected:
- **Frontend**: Based on `Vite MODE` → `production` = Mainnet, `development` = Devnet
- **Backend**: Based on `NODE_ENV` → `production` = Mainnet, `development` = Devnet

### Mainnet Deployment Checklist

Before deploying to mainnet, ensure:

1. **Platform Wallet Funding**: The platform wallet `AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U` must have:
   - Sufficient SOL balance for transaction fees (recommend 1-5 SOL)
   - USDC balance if clients will pay with USDC (optional but recommended)

2. **Vercel Environment Variables**:
   - Frontend: Set `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - Backend: Set `NODE_ENV=production`, `PLATFORM_WALLET_PRIVATE_KEY`, all Supabase keys
   - Optional: Set `SOLANA_MAINNET_RPC` for better reliability (use paid RPC services)

3. **Network Matching**: Users must set their Phantom wallet to **Mainnet** when using the production app

See `MAINNET_READINESS.md` for detailed setup instructions.

## Platform Wallet

The escrow wallet address: `AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U`

This wallet holds all escrow funds and automatically releases payments to freelancers when projects are completed.

## Payment Flow

1. Client posts project and funds escrow (amount + 10% platform fee)
2. Funds are locked in platform escrow wallet
3. Freelancer completes work
4. Client marks project as completed
5. Platform wallet automatically sends payment to freelancer's wallet
6. Platform fee (10%) remains in platform wallet

## Deployment

Both frontend and backend are deployed to Vercel:

- **Frontend**: https://www.lancerfi.app
- **Backend API**: Configured via Vercel environment variables

See Vercel dashboard for environment variable configuration.

## Security

- Platform wallet private key is stored securely in backend only (never in frontend)
- Wallet signature authentication required for payment operations
- Server-side authorization checks prevent unauthorized access
- Duplicate payment prevention built-in
- Transaction confirmation on Solana blockchain

## License

MIT
