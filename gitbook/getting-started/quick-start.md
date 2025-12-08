# Quick Start

Get started with LancerFi in just a few steps!

## For Users

### 1. Connect Your Wallet

1. Visit [lancerfi.app](https://www.lancerfi.app)
2. Click "Connect Wallet"
3. Select your Phantom wallet
4. Approve the connection

### 2. As a Client

**Post a Project:**
1. Click "Post Project" in the navigation
2. Fill in project details (title, description, budget, deadline)
3. Fund the escrow with SOL, USDC, or X402
4. Wait for proposals from freelancers
5. Select a freelancer
6. Approve work when completed

**Release Payment:**
1. Review submitted work
2. Click "Approve" if satisfied
3. Payment is automatically released to the freelancer

### 3. As a Freelancer

**Create Profile:**
1. Click "Profile" in the navigation
2. Fill in your skills, experience, and portfolio
3. Add service categories
4. Save your profile

**Find Work:**
1. Browse available projects
2. Submit proposals with your bid
3. Wait for client selection
4. Complete the work
5. Submit work for review
6. Receive payment upon approval

## For Developers

### Quick Setup

```bash
# Clone the repository
git clone https://github.com/LancerFinance/LancerFi
cd LancerFi

# Install dependencies
npm install
cd server && npm install && cd ..

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run development servers
npm run dev  # Frontend (port 8080)
cd server && npm run dev  # Backend (port 3001)
```

See the [Installation Guide](../installation/README.md) for detailed setup instructions.

## Next Steps

- [User Guide](../user-guide/README.md) - Detailed usage instructions
- [Payment Flow](../payment-flow/README.md) - Understand payments
- [Development](../development/README.md) - For developers

