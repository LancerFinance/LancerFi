import { ethers } from 'ethers';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');

// Base network configuration
const BASE_CHAIN_ID = 8453; // Base mainnet
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base USDC
const BASE_RPC_URL = 'https://mainnet.base.org';

// Base platform wallet address for x402 payments
// This is a fresh new wallet created specifically for Base USDC
export const BASE_PLATFORM_WALLET_ADDRESS = '0xdbbE0aDAD2931779270e4E2588b772e7b38453ba';

export function getBasePlatformWalletAddress(): string {
  return BASE_PLATFORM_WALLET_ADDRESS;
}

// ERC20 ABI for USDC transfer
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

export interface X402PaymentChallenge {
  amount: string;
  currency: string;
  recipient: string;
  network: string;
  mint: string;
  projectId: string;
  clientWallet: string;
  platformFee: string;
  message: string;
}

/**
 * Request x402 payment challenge from backend
 * Returns payment details needed to make the payment
 */
export async function requestX402Payment(
  projectId: string,
  amount: number,
  clientWallet: string
): Promise<X402PaymentChallenge> {
  const response = await fetch(`${API_BASE_URL}/api/x402/payment-required`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      amount,
      clientWallet,
    }),
  });

  // x402 protocol: Backend responds with HTTP 402 when payment is required
  // NOTE: Browser console will show 402 as an error (red), but this is CORRECT behavior for x402 protocol
  // HTTP 402 "Payment Required" is the standard response for x402 payment challenges
  if (response.status === 402) {
    const paymentDetails = await response.json();
    return paymentDetails as X402PaymentChallenge;
  }

  // If not 402, it's an error - provide detailed error message
  let errorMessage = `Unexpected response status: ${response.status}`;
  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    // If response isn't JSON, use status text
    errorMessage = response.statusText || errorMessage;
  }
  
  // If 404, the backend endpoint doesn't exist (not deployed)
  if (response.status === 404) {
    throw new Error(`x402 backend endpoint not found (404). The x402 payment feature may not be deployed yet. Please use SOL or USDC payment instead.`);
  }
  
  throw new Error(`x402 payment request failed: ${errorMessage}`);
}

/**
 * Process x402 payment using user's wallet on Base network
 * Creates and sends USDC transaction to the recipient address
 */
export async function processX402Payment(
  paymentChallenge: X402PaymentChallenge,
  wallet: any // Phantom wallet (supports EVM chains including Base)
): Promise<string> {
  // Check if wallet supports EVM (ethereum provider)
  if (!wallet?.ethereum && !wallet?.isPhantom) {
    throw new Error('Wallet must support EVM chains (Base network)');
  }

  // Get Ethereum provider from Phantom
  // Phantom provides ethereum provider for EVM chains
  const w: any = window as any;
  let ethereumProvider = w.ethereum;
  
  // If wallet is Phantom, check if it has ethereum provider
  if (wallet.isPhantom && (wallet as any).ethereum) {
    ethereumProvider = (wallet as any).ethereum;
  } else if (!ethereumProvider && wallet.ethereum) {
    ethereumProvider = wallet.ethereum;
  }
  
  if (!ethereumProvider) {
    throw new Error('Ethereum provider not found. Please ensure your wallet (Phantom) supports Base network and has EVM capabilities enabled.');
  }
  
  const provider = new ethers.BrowserProvider(ethereumProvider);

  // Request to switch to Base network if not already on it
  try {
    await provider.send('wallet_switchEthereumChain', [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }]);
  } catch (switchError: any) {
    // If chain doesn't exist, add it
    if (switchError.code === 4902 || switchError.code === -32603) {
      try {
        await provider.send('wallet_addEthereumChain', [{
          chainId: `0x${BASE_CHAIN_ID.toString(16)}`,
          chainName: 'Base',
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: [BASE_RPC_URL],
          blockExplorerUrls: ['https://basescan.org']
        }]);
        // Switch to the newly added chain
        await provider.send('wallet_switchEthereumChain', [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }]);
      } catch (addError) {
        throw new Error('Failed to add Base network to wallet. Please add Base network manually.');
      }
    } else if (switchError.code !== 4902) {
      throw new Error('Failed to switch to Base network');
    }
  }

  // Get signer
  const signer = await provider.getSigner();
  const clientAddress = await signer.getAddress();

  // Verify client address matches
  if (clientAddress.toLowerCase() !== paymentChallenge.clientWallet.toLowerCase()) {
    throw new Error(`Connected wallet address (${clientAddress}) does not match expected address (${paymentChallenge.clientWallet})`);
  }

  // Create USDC contract instance
  const usdcContract = new ethers.Contract(BASE_USDC_ADDRESS, ERC20_ABI, signer);

  // Get USDC decimals (should be 6)
  const decimals = await usdcContract.decimals();
  
  // Convert amount to wei (USDC has 6 decimals on Base)
  const amount = parseFloat(paymentChallenge.amount);
  const amountInWei = ethers.parseUnits(amount.toFixed(decimals), decimals);

  // Check balance
  const balance = await usdcContract.balanceOf(clientAddress);
  if (balance < amountInWei) {
    throw new Error(`Insufficient USDC balance. Required: ${amount} USDC, Available: ${ethers.formatUnits(balance, decimals)} USDC`);
  }

  // Create transfer transaction
  const recipientAddress = paymentChallenge.recipient;
  
  try {
    // Send transaction
    const tx = await usdcContract.transfer(recipientAddress, amountInWei);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    // Return transaction hash
    return receipt.hash;
  } catch (error: any) {
    console.error('Base USDC transfer failed:', error);
    
    // If user rejected, let them know
    if (error?.code === 4001 || error.message?.includes('User rejected') || error.message?.includes('user rejected')) {
      throw new Error('Transaction was cancelled by user');
    }
    if (error.message?.includes('insufficient funds') || error.message?.includes('not enough')) {
      throw new Error('Insufficient USDC or ETH for transaction fees. Please ensure you have enough USDC and ETH in your wallet.');
    }
    
    throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Verify x402 payment with backend
 * Backend checks the transaction on-chain and confirms payment was received
 */
export async function verifyX402Payment(
  projectId: string,
  transactionSignature: string,
  clientWallet: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/x402/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectId,
        transactionSignature,
        clientWallet,
        amount,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || `HTTP ${response.status}` };
      }
      
      console.error('x402 verification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const result = await response.json();
    
    console.log('x402 verification result:', {
      verified: result.verified,
      success: result.success,
      error: result.error,
      transactionSignature: transactionSignature.substring(0, 20) + '...',
      fullResult: result
    });
    
    // Backend returns { success: true, verified: true } on success
    // Check both success and verified fields
    return {
      success: result.success === true && result.verified === true,
      error: result.error
    };
  } catch (error: any) {
    console.error('x402 verification exception:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify payment - network error'
    };
  }
}
