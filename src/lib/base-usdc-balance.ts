import { ethers } from 'ethers';

// Base network configuration
const BASE_CHAIN_ID = 8453; // Base mainnet
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const BASE_RPC_URL = 'https://mainnet.base.org';

// ERC20 ABI for USDC balance check
const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

/**
 * Get Base USDC balance for a wallet address
 * @param walletAddress - EVM wallet address (0x...)
 * @returns USDC balance as a number
 */
export async function getBaseUSDCBalance(walletAddress: string): Promise<number> {
  try {
    // Create provider for Base network
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    
    // Create USDC contract instance
    const usdcContract = new ethers.Contract(BASE_USDC_ADDRESS, ERC20_ABI, provider);
    
    // Get balance and decimals
    const [balance, decimals] = await Promise.all([
      usdcContract.balanceOf(walletAddress),
      usdcContract.decimals()
    ]);
    
    // Convert from wei to USDC (6 decimals)
    const balanceInUSDC = parseFloat(ethers.formatUnits(balance, decimals));
    
    return balanceInUSDC;
  } catch (error: any) {
    console.error('Error fetching Base USDC balance:', error);
    // Return 0 if there's an error (e.g., wallet has no Base USDC)
    return 0;
  }
}

/**
 * Get Base USDC balance using wallet provider (for connected wallet)
 * This requires the wallet to be connected to Base network
 */
export async function getBaseUSDCBalanceFromWallet(wallet: any): Promise<number> {
  try {
    // Get Ethereum provider from wallet
    const w: any = window as any;
    let ethereumProvider = w.ethereum;
    
    if (wallet?.ethereum) {
      ethereumProvider = wallet.ethereum;
    } else if (wallet?.isPhantom && (wallet as any).ethereum) {
      ethereumProvider = (wallet as any).ethereum;
    }
    
    if (!ethereumProvider) {
      throw new Error('Ethereum provider not found');
    }
    
    const provider = new ethers.BrowserProvider(ethereumProvider);
    
    // Get signer to get connected address
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    
    // Get balance using the address
    return await getBaseUSDCBalance(address);
  } catch (error: any) {
    console.error('Error fetching Base USDC balance from wallet:', error);
    return 0;
  }
}

