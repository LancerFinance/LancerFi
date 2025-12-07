# Security Guide

This document outlines security best practices for setting up and deploying LancerFi.

## ⚠️ Critical Security Warnings

**NEVER commit the following to version control:**
- Private keys (Solana wallet private keys, API keys, etc.)
- Database credentials
- Service role keys
- Any production secrets or credentials

## Required Environment Variables

### Frontend Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_API_URL=https://your-backend-domain.vercel.app
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

### Backend Environment Variables

Create a `.env` file in the `server/` directory with the following variables:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend-domain.vercel.app

# Platform Wallet Private Key (CRITICAL - Keep Secure!)
# Generate a new Solana wallet and export the private key
# Format: [42,5,181,154,...] or comma-separated: 42,5,181,154,...
PLATFORM_WALLET_PRIVATE_KEY=your-platform-wallet-private-key-here

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Solana RPC (optional - uses defaults if not set)
SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com
SOLANA_DEVNET_RPC=https://api.devnet.solana.com
```

## Setting Up Credentials

### 1. Supabase Setup

1. Create a new project at [Supabase](https://app.supabase.com)
2. Go to Project Settings → API
3. Copy the following:
   - **Project URL** → Use for `SUPABASE_URL` and `VITE_SUPABASE_URL`
   - **anon/public key** → Use for `VITE_SUPABASE_ANON_KEY` and `SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_KEY` (backend only, keep secret!)

### 2. Solana Wallet Setup

Generate a new Solana wallet for the platform:

```bash
# Install Solana CLI if not already installed
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new keypair
solana-keygen new --outfile platform-wallet.json

# Export the private key as a JSON array
# You can use a script or manually format it
```

**Important:** This wallet will hold platform funds. Store the private key securely and never share it.

### 3. Vercel Deployment

For Vercel deployments, set environment variables in the Vercel dashboard:

1. Go to your project settings
2. Navigate to Environment Variables
3. Add each variable for the appropriate environment (Production, Preview, Development)

See `scripts/setup-vercel-env.sh` for a list of required variables.

## Security Best Practices

1. **Use Environment Variables**: Never hardcode secrets in source code
2. **Separate Environments**: Use different credentials for development, staging, and production
3. **Rotate Keys Regularly**: Periodically rotate API keys and credentials
4. **Limit Access**: Only grant necessary permissions to team members
5. **Monitor Access**: Regularly review who has access to sensitive credentials
6. **Use Secrets Management**: Consider using a secrets management service for production

## Database Security

- Enable Row Level Security (RLS) policies in Supabase
- Use service role key only on the backend, never expose it to the frontend
- Regularly review and update database access policies

## Wallet Security

- The platform wallet private key is the most sensitive credential
- Store it securely (use a password manager or secrets management service)
- Never commit it to version control
- Consider using hardware wallets or multi-sig for production deployments
- Regularly audit wallet transactions

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:
- Do not open a public issue
- Contact the maintainers privately
- Allow time for the issue to be addressed before public disclosure

## Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [Solana Security Best Practices](https://docs.solana.com/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

