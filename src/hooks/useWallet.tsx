import { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: any | null;
  chain?: 'evm' | 'solana';
}

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    provider: null,
  });

  useEffect(() => {
    const init = async () => {
      const w: any = window as any;
      // Check EVM wallets
      try {
        if (w.ethereum) {
          const provider = new BrowserProvider(w.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts && accounts.length > 0) {
            const address = accounts[0].address;
            setWallet({
              address,
              isConnected: true,
              isConnecting: false,
              provider,
              chain: 'evm',
            });
            return;
          }
        }
      } catch {}

      // Check Phantom (Solana)
      try {
        if (w.solana && w.solana.isPhantom && w.solana.isConnected) {
          const address = w.solana.publicKey?.toString?.();
          if (address) {
            setWallet({
              address,
              isConnected: true,
              isConnecting: false,
              provider: w.solana,
              chain: 'solana',
            });
          }
        }
      } catch {}
    };

    init();
  }, []);

  const connectWallet = async () => {
    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      const w: any = window as any;

      // Try EVM (MetaMask) first
      if (w.ethereum) {
        const provider = new BrowserProvider(w.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        setWallet({
          address,
          isConnected: true,
          isConnecting: false,
          provider,
          chain: 'evm',
        });
        return;
      }

      // Fallback to Solana (Phantom)
      if (w.solana && w.solana.isPhantom) {
        const resp = await w.solana.connect();
        const address = resp?.publicKey?.toString?.() || w.solana?.publicKey?.toString?.();
        if (!address) throw new Error('Unable to get Solana wallet address');

        setWallet({
          address,
          isConnected: true,
          isConnecting: false,
          provider: w.solana,
          chain: 'solana',
        });
        return;
      }

      alert('No wallet detected. Please install MetaMask (EVM) or Phantom (Solana).');
      setWallet(prev => ({ ...prev, isConnecting: false }));
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setWallet(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const disconnectWallet = () => {
    setWallet({
      address: null,
      isConnected: false,
      isConnecting: false,
      provider: null,
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return {
    ...wallet,
    connectWallet,
    disconnectWallet,
    formatAddress,
  };
};