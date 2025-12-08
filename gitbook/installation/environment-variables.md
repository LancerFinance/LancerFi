# Environment Variables

Complete guide to configuring environment variables for LancerFi.

## Frontend Variables

Create a `.env` file in the root directory:

```env
# API Configuration
VITE_API_URL=http://localhost:3001

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Variable Descriptions

- **VITE_API_URL**: Backend API URL (use `http://localhost:3001` for local development)
- **VITE_SUPABASE_URL**: Your Supabase project URL
- **VITE_SUPABASE_ANON_KEY**: Supabase anonymous/public key

## Backend Variables

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8080

# Platform Wallet (CRITICAL - Keep Secure!)
PLATFORM_WALLET_PRIVATE_KEY=[your_private_key_array]

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Custom RPC Endpoint
SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com
```

### Variable Descriptions

- **PORT**: Server port (default: 3001)
- **NODE_ENV**: Environment mode (`development` or `production`)
- **FRONTEND_URL**: Frontend URL for CORS
- **PLATFORM_WALLET_PRIVATE_KEY**: Platform wallet private key as array (NEVER expose this!)
- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_SERVICE_KEY**: Supabase service role key (has admin access)
- **SUPABASE_ANON_KEY**: Supabase anonymous key
- **SOLANA_MAINNET_RPC**: Optional custom RPC endpoint

## Network Configuration

### Development Mode
- Frontend: Uses Devnet when `NODE_ENV=development`
- Backend: Uses Devnet when `NODE_ENV=development`

### Production Mode
- Frontend: Uses Mainnet when `NODE_ENV=production`
- Backend: Uses Mainnet when `NODE_ENV=production`

## Security Best Practices

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Use different keys for dev/prod** - Never use production keys in development
3. **Rotate keys regularly** - Especially if exposed
4. **Limit service key access** - Service key has admin privileges
5. **Use environment-specific configs** - Separate dev/staging/prod

## Getting Supabase Keys

1. Go to [supabase.com](https://supabase.com/)
2. Select your project
3. Go to Settings → API
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_KEY` (backend only!)

## Platform Wallet Setup

The platform wallet is used for escrow operations. To generate a new wallet:

```bash
# Using Solana CLI
solana-keygen new --outfile platform-wallet.json

# Extract private key array (use a script or tool)
```

**Important**: The platform wallet must be funded with SOL for transaction fees.

## Next Steps

- [Running Locally](running-locally.md)
- [Deployment](../deployment/README.md)

