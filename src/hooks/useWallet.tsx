import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: any | null;
}

interface WalletContextValue extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  formatAddress: (address: string) => string;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    provider: null,
  });

  // Optional auto-connect behind a user-controlled flag (disabled by default)
  useEffect(() => {
    const shouldAutoConnect = localStorage.getItem('wallet_auto_connect') === 'true';
    if (!shouldAutoConnect) return;

    const init = async () => {
      const w: any = window as any;
      
      // Try Phantom if already connected
      try {
        if (w.solana && w.solana.isPhantom && w.solana.isConnected) {
          const address = w.solana.publicKey?.toString?.();
          if (address) {
            setWallet({ address, isConnected: true, isConnecting: false, provider: w.solana });
          }
        }
      } catch {}
    };

    init();
  }, []);

  // Listen to wallet account changes to keep global state in sync
  useEffect(() => {
    const w: any = window as any;

    if (w.solana && w.solana.on) {
      w.solana.on('disconnect', () => {
        setWallet({ address: null, isConnected: false, isConnecting: false, provider: null });
      });
      w.solana.on('connect', (pubkey: any) => {
        const address = pubkey?.toString?.() || w.solana?.publicKey?.toString?.();
        if (address) setWallet(prev => ({ ...prev, address, isConnected: true, provider: w.solana }));
      });
    }

    return () => {
      if (w.solana?.removeAllListeners) {
        try { w.solana.removeAllListeners('disconnect'); } catch {}
        try { w.solana.removeAllListeners('connect'); } catch {}
      }
    };
  }, []);

  const connectWallet = async () => {
    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      const w: any = window as any;

      // Connect to Solana (Phantom)
      if (w.solana && w.solana.isPhantom) {
        const resp = await w.solana.connect();
        const address = resp?.publicKey?.toString?.() || w.solana?.publicKey?.toString?.();
        if (!address) throw new Error('Unable to get Solana wallet address');

        setWallet({ address, isConnected: true, isConnecting: false, provider: w.solana });
        return;
      }

      alert('No Phantom wallet detected. Please install Phantom wallet.');
      setWallet(prev => ({ ...prev, isConnecting: false }));
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setWallet(prev => ({ ...prev, isConnecting: false }));
    }
  };

  const disconnectWallet = () => {
    try {
      const w: any = window as any;
      if (w.solana?.disconnect) {
        w.solana.disconnect();
      }
    } catch {}

    localStorage.removeItem('wallet_auto_connect');
    setWallet({ address: null, isConnected: false, isConnecting: false, provider: null });
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const value: WalletContextValue = {
    ...wallet,
    connectWallet,
    disconnectWallet,
    formatAddress,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return ctx;
};