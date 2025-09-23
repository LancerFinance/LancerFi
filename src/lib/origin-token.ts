import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { connection } from './solana';

// Origin Token Configuration (Pump.fun token)
export const ORIGIN_MINT = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'); // Origin token mint from Pump.fun
export const ORIGIN_DECIMALS = 9; // Standard SPL token decimals

// DEX Configuration for USDC/Origin swaps
export const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';
export const RAYDIUM_PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

// Price Oracle Configuration
interface PriceData {
  price: number;
  timestamp: number;
  source: string;
}

interface ConversionQuote {
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  minimumReceived: number;
  route: any[];
  swapTransaction?: string;
}

// Get Origin token balance
export async function getOriginBalance(walletAddress: PublicKey): Promise<number> {
  try {
    const tokenAccount = await getAssociatedTokenAddress(ORIGIN_MINT, walletAddress);
    const accountInfo = await connection.getTokenAccountBalance(tokenAccount);
    return parseFloat(accountInfo.value.uiAmount?.toString() || '0');
  } catch (error) {
    console.error('Error getting Origin balance:', error);
    return 0;
  }
}

// Get USDC to Origin conversion rate
export async function getUSDCToOriginRate(): Promise<number> {
  try {
    // Use Jupiter API for real-time pricing
    const response = await fetch(
      `${JUPITER_API_URL}/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=${ORIGIN_MINT.toString()}&amount=1000000&slippageBps=50`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch price from Jupiter');
    }
    
    const data = await response.json();
    const outputAmount = parseInt(data.outAmount) / Math.pow(10, ORIGIN_DECIMALS);
    const inputAmount = 1; // 1 USDC
    
    return outputAmount / inputAmount; // Origin tokens per USDC
  } catch (error) {
    console.error('Error fetching USDC/Origin rate:', error);
    // Fallback rate (this should be updated based on current market data)
    return 1000; // Example: 1 USDC = 1000 ORIGIN tokens
  }
}

// Get conversion quote for USDC to Origin
export async function getConversionQuote(
  usdcAmount: number,
  slippageBps: number = 50
): Promise<ConversionQuote> {
  try {
    const inputAmountLamports = Math.floor(usdcAmount * 1_000_000); // USDC has 6 decimals
    
    const response = await fetch(
      `${JUPITER_API_URL}/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=${ORIGIN_MINT.toString()}&amount=${inputAmountLamports}&slippageBps=${slippageBps}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch conversion quote');
    }
    
    const data = await response.json();
    const outputAmount = parseInt(data.outAmount) / Math.pow(10, ORIGIN_DECIMALS);
    const minimumReceived = parseInt(data.otherAmountThreshold) / Math.pow(10, ORIGIN_DECIMALS);
    
    return {
      inputAmount: usdcAmount,
      outputAmount,
      priceImpact: parseFloat(data.priceImpactPct || '0'),
      minimumReceived,
      route: data.routePlan || []
    };
  } catch (error) {
    console.error('Error getting conversion quote:', error);
    // Fallback calculation
    const rate = await getUSDCToOriginRate();
    const outputAmount = usdcAmount * rate;
    
    return {
      inputAmount: usdcAmount,
      outputAmount,
      priceImpact: 0.5, // Assume 0.5% impact
      minimumReceived: outputAmount * 0.995, // 0.5% slippage
      route: []
    };
  }
}

// Create swap transaction from USDC to Origin
export async function createUSDCToOriginSwap(
  userWallet: PublicKey,
  usdcAmount: number,
  slippageBps: number = 50
): Promise<string> {
  try {
    const inputAmountLamports = Math.floor(usdcAmount * 1_000_000);
    
    // Get quote first
    const quoteResponse = await fetch(
      `${JUPITER_API_URL}/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=${ORIGIN_MINT.toString()}&amount=${inputAmountLamports}&slippageBps=${slippageBps}`
    );
    
    if (!quoteResponse.ok) {
      throw new Error('Failed to get swap quote');
    }
    
    const quoteData = await quoteResponse.json();
    
    // Get swap transaction
    const swapResponse = await fetch(`${JUPITER_API_URL}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: userWallet.toString(),
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: 'auto'
      }),
    });
    
    if (!swapResponse.ok) {
      throw new Error('Failed to create swap transaction');
    }
    
    const swapData = await swapResponse.json();
    return swapData.swapTransaction; // Base64 encoded transaction
  } catch (error) {
    console.error('Error creating USDC to Origin swap:', error);
    throw error;
  }
}

// Format Origin token amount
export function formatOrigin(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0 ORIGIN';
  }
  
  // Format with appropriate decimals based on amount size
  let formatted: string;
  if (amount >= 1000000) {
    formatted = (amount / 1000000).toFixed(2) + 'M';
  } else if (amount >= 1000) {
    formatted = (amount / 1000).toFixed(2) + 'K';
  } else if (amount >= 1) {
    formatted = amount.toFixed(2);
  } else {
    formatted = amount.toFixed(6);
  }
  
  return `${formatted} ORIGIN`;
}

// Validate Origin token address
export function validateOriginAmount(amount: number, balance: number): { isValid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: 'Please enter a valid amount' };
  }
  
  if (amount > balance) {
    return { isValid: false, error: 'Insufficient Origin token balance' };
  }
  
  return { isValid: true };
}

// Calculate platform fee in Origin tokens
export function calculateOriginFee(originAmount: number, feePercent: number = 10): number {
  return (originAmount * feePercent) / 100;
}

// Get current market data for Origin token
export async function getOriginMarketData(): Promise<{
  price_usdc: number;
  volume_24h: number;
  market_cap: number;
  price_change_24h: number;
}> {
  try {
    // This would typically call a price API like CoinGecko, Jupiter, or Pump.fun API
    // For now, returning mock data - replace with actual API calls
    return {
      price_usdc: 0.001, // Example: 1 ORIGIN = 0.001 USDC
      volume_24h: 50000,
      market_cap: 1000000,
      price_change_24h: 2.5 // 2.5% increase
    };
  } catch (error) {
    console.error('Error fetching Origin market data:', error);
    return {
      price_usdc: 0.001,
      volume_24h: 0,
      market_cap: 0,
      price_change_24h: 0
    };
  }
}