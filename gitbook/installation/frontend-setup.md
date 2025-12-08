# Frontend Setup

This guide covers setting up the LancerFi React frontend.

## Installation

```bash
# Clone the repository
git clone https://github.com/LancerFinance/LancerFi
cd LancerFi

# Install dependencies
npm install
```

## Project Structure

```
src/
├── components/     # React components
├── pages/          # Page components
├── hooks/          # Custom React hooks
├── lib/            # Utility functions and libraries
├── integrations/   # Third-party integrations
└── main.tsx        # Application entry point
```

## Key Technologies

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Styling
- **shadcn-ui**: Component library
- **React Router**: Routing
- **Solana Web3.js**: Blockchain integration

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

See [Environment Variables](environment-variables.md) for detailed configuration.

## Running the Frontend

```bash
# Development server (runs on http://localhost:8080)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Development Tips

- The frontend automatically connects to Solana Devnet in development mode
- Use Phantom wallet for testing
- Hot module replacement is enabled for fast development

## Next Steps

- [Backend Setup](backend-setup.md)
- [Running Locally](running-locally.md)

