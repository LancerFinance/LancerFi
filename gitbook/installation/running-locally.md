# Running Locally

Complete guide to running LancerFi on your local machine.

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/LancerFinance/LancerFi
cd LancerFi

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd server
npm install
cd ..

# 4. Set up environment variables
# Create .env in root and server/.env
# See environment-variables.md for details

# 5. Run both servers
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd server
npm run dev
```

## Detailed Steps

### 1. Clone Repository

```bash
git clone https://github.com/LancerFinance/LancerFi
cd LancerFi
```

### 2. Install Dependencies

**Frontend:**
```bash
npm install
```

**Backend:**
```bash
cd server
npm install
cd ..
```

### 3. Configure Environment

**Frontend `.env` (root directory):**
```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Backend `.env` (server directory):**
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
PLATFORM_WALLET_PRIVATE_KEY=[your_private_key_array]
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com/)
2. Run database migrations (if needed)
3. Get your API keys from Settings → API

### 5. Run Development Servers

**Terminal 1 - Frontend:**
```bash
npm run dev
```
Frontend will be available at: http://localhost:8080

**Terminal 2 - Backend:**
```bash
cd server
npm run dev
```
Backend API will be available at: http://localhost:3001

### 6. Connect Wallet

1. Open http://localhost:8080 in your browser
2. Install Phantom wallet extension if not already installed
3. Switch Phantom to **Devnet** (Settings → Developer Mode → Change Network)
4. Click "Connect Wallet" in the app
5. Approve the connection

## Testing

### Test as Client
1. Connect wallet
2. Click "Post Project"
3. Create a test project
4. Fund escrow (use Devnet SOL - get from faucet)

### Test as Freelancer
1. Create a freelancer profile
2. Browse projects
3. Submit a proposal
4. Complete work and submit

## Troubleshooting

### Port Already in Use
```bash
# Change port in package.json or .env
# Frontend: Vite default is 8080
# Backend: PORT=3001 in server/.env
```

### Wallet Connection Issues
- Ensure Phantom is set to Devnet
- Clear browser cache
- Check browser console for errors

### Database Errors
- Verify Supabase connection
- Check environment variables
- Ensure migrations are run

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

## Development Tips

- Use browser DevTools for debugging
- Check backend logs in terminal
- Use React DevTools extension
- Enable source maps in Vite config

## Next Steps

- [User Guide](../user-guide/README.md)
- [Development](../development/README.md)
- [Deployment](../deployment/README.md)

