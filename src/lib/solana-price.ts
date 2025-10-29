// Live SOL price fetching utility
export interface SolanaPriceData {
  price_usd: number;
  price_change_24h: number;
  last_updated: string;
}

// Cache for price data to avoid excessive API calls
let priceCache: { data: SolanaPriceData | null; timestamp: number } = {
  data: null,
  timestamp: 0
};

const CACHE_DURATION = 60000; // 1 minute cache

export async function getSolanaPrice(): Promise<SolanaPriceData> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (priceCache.data && (now - priceCache.timestamp) < CACHE_DURATION) {
    return priceCache.data;
  }

  try {
    // Try CoinGecko API first (free, reliable)
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true');
    
    if (!response.ok) {
      throw new Error('CoinGecko API failed');
    }
    
    const data = await response.json();
    const solData = data.solana;
    
    const priceData: SolanaPriceData = {
      price_usd: solData.usd,
      price_change_24h: solData.usd_24h_change || 0,
      last_updated: new Date().toISOString()
    };
    
    // Update cache
    priceCache = {
      data: priceData,
      timestamp: now
    };
    
    return priceData;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    
    // Fallback to a reasonable default price if API fails
    const fallbackPrice: SolanaPriceData = {
      price_usd: 100, // Reasonable fallback
      price_change_24h: 0,
      last_updated: new Date().toISOString()
    };
    
    return fallbackPrice;
  }
}

// Convert USD amount to SOL
export async function convertUSDToSOL(usdAmount: number): Promise<number> {
  const priceData = await getSolanaPrice();
  return usdAmount / priceData.price_usd;
}

// Convert SOL amount to USD
export async function convertSOLToUSD(solAmount: number): Promise<number> {
  const priceData = await getSolanaPrice();
  return solAmount * priceData.price_usd;
}
