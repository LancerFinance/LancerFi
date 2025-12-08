# Backend Setup

This guide covers setting up the LancerFi Node.js backend.

## Installation

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install
```

## Project Structure

```
server/
├── routes/         # API route handlers
├── services/       # Business logic services
├── middleware/     # Express middleware
├── handlers/       # Payment handlers
└── index.ts        # Server entry point
```

## Key Technologies

- **Node.js**: Runtime environment
- **Express**: Web framework
- **TypeScript**: Type safety
- **Supabase**: Database and auth
- **Solana Web3.js**: Blockchain integration

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8080
PLATFORM_WALLET_PRIVATE_KEY=[your_private_key_array]
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

See [Environment Variables](environment-variables.md) for detailed configuration.

## Running the Backend

```bash
# Development server (runs on http://localhost:3001)
npm run dev

# Production build
npm run build

# Start production server
npm start
```

## API Endpoints

The backend provides various API endpoints:
- `/api/projects` - Project management
- `/api/payments` - Payment processing
- `/api/messages` - Messaging system
- `/api/admin` - Admin functions

See [API Reference](../development/api-reference.md) for complete documentation.

## Security Notes

- Never commit `.env` files
- Keep `PLATFORM_WALLET_PRIVATE_KEY` secure
- Use environment variables for all sensitive data

## Next Steps

- [Environment Variables](environment-variables.md)
- [Running Locally](running-locally.md)

