# How Payments Work

Understanding the LancerFi payment flow and escrow system.

## Overview

LancerFi uses a blockchain-based escrow system to ensure secure payments between clients and freelancers. Funds are locked in the platform wallet until project completion.

## Payment Flow

### 1. Project Creation & Funding

```
Client → Creates Project → Funds Escrow (Amount + 1% Fee)
```

- Client posts a project with budget
- Client funds the escrow with SOL, USDC, or X402
- Platform fee (1%) is included in the funding
- Funds are locked in the platform escrow wallet

### 2. Freelancer Selection

```
Freelancer → Submits Proposal → Client Selects → Funds Locked
```

- Freelancers submit proposals
- Client reviews and selects a freelancer
- Funds remain locked in escrow

### 3. Work Completion

```
Freelancer → Completes Work → Submits Work → Client Reviews
```

- Freelancer completes the work
- Work is submitted through the platform
- Files are scanned for security
- Client receives notification

### 4. Payment Release

```
Client Approves → Payment Released → Freelancer Receives Funds
```

- Client reviews and approves work
- Payment is automatically released to freelancer
- Platform fee (1%) remains in platform wallet
- Transaction is recorded on-chain

## Escrow Wallet

**Address**: `YOUR_ADMIN_WALLET_ADDRESS`

This wallet:
- Holds all escrow funds
- Automatically releases payments upon approval
- Retains platform fees
- Requires sufficient SOL for transaction fees

## Platform Fee

- **Rate**: 1% of project value
- **Deducted**: Automatically from escrow funding
- **Retained**: In platform wallet
- **Transparent**: Included in initial funding amount

## Payment Methods

### SOL (Solana Native Token)
- Fast transactions
- Low fees
- Native to Solana blockchain

### USDC (USD Coin)
- Price stability
- Stablecoin payments
- SPL token on Solana

### X402
- X402 payment protocol
- Alternative payment method
- Integrated for flexibility

## Security

- Funds are locked in blockchain escrow
- No manual intervention required
- Automatic release upon approval
- All transactions are on-chain and verifiable

## Disputes

Currently, disputes are handled through:
- Admin support system
- Direct messaging between parties
- Manual review process

Future: Automated dispute resolution system (see roadmap)

## Next Steps

- [X402 Payment Integration](x402-payment.md)
- [Platform Fees](platform-fees.md)

