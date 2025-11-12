import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: any | null;
}

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

interface WalletContextValue extends WalletState {
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  formatAddress: (address: string) => string;
  signMessage: (message: string) => Promise<{ signature: Uint8Array }>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    provider: null,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Optional auto-connect behind a user-controlled flag (disabled by default)
  useEffect(() => {
    const shouldAutoConnect = localStorage.getItem('wallet_auto_connect') === 'true';
    const wasExplicitlyDisconnected = localStorage.getItem('wallet_explicitly_disconnected') === 'true';
    
    const init = async () => {
      const w: any = window as any;
      
      // If user explicitly disconnected, disconnect Phantom if it's still connected
      if (wasExplicitlyDisconnected) {
        try {
          if (w.solana && w.solana.isPhantom && w.solana.isConnected) {
            // Phantom is still connected but user explicitly disconnected
            // Disconnect it to respect user's choice
            if (w.solana.disconnect) {
              await w.solana.disconnect();
            }
          }
        } catch {}
        // Don't auto-connect if user explicitly disconnected
        return;
      }
      
      // Don't auto-connect if flag is not set
      if (!shouldAutoConnect) {
        return;
      }

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
        // Set explicit disconnect flag when Phantom disconnects
        localStorage.setItem('wallet_explicitly_disconnected', 'true');
        localStorage.removeItem('wallet_auto_connect');
        setWallet({ address: null, isConnected: false, isConnecting: false, provider: null });
      });
      w.solana.on('connect', (pubkey: any) => {
        // Only reconnect if user didn't explicitly disconnect
        const wasExplicitlyDisconnected = localStorage.getItem('wallet_explicitly_disconnected') === 'true';
        if (wasExplicitlyDisconnected) {
          // User explicitly disconnected, don't auto-reconnect
          // Disconnect again to respect user's choice
          try {
            if (w.solana?.disconnect) {
              w.solana.disconnect();
            }
          } catch {}
          return;
        }
        
        const address = pubkey?.toString?.() || w.solana?.publicKey?.toString?.();
        if (address) {
          setWallet(prev => ({ ...prev, address, isConnected: true, provider: w.solana }));
        }
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
    // Clear explicit disconnect flag FIRST before connecting
    // This prevents the connect event listener from disconnecting immediately
    localStorage.removeItem('wallet_explicitly_disconnected');
    
    setWallet(prev => ({ ...prev, isConnecting: true }));

    try {
      const w: any = window as any;

      // Connect to Solana (Phantom)
      if (w.solana && w.solana.isPhantom) {
        const resp = await w.solana.connect();
        const address = resp?.publicKey?.toString?.() || w.solana?.publicKey?.toString?.();
        if (!address) throw new Error('Unable to get Solana wallet address');

        // Check if wallet is banned
        try {
          const { db } = await import('@/lib/supabase');
          const restriction = await db.checkUserRestriction(address);
          if (restriction.isRestricted && restriction.restrictionType === 'ban_wallet') {
            // Disconnect wallet immediately
            if (w.solana?.disconnect) {
              await w.solana.disconnect();
            }
            setWallet({ address: null, isConnected: false, isConnecting: false, provider: null });
            const expiresAt = restriction.expiresAt 
              ? new Date(restriction.expiresAt).toLocaleString()
              : 'permanently';
            alert(`Your wallet is banned ${expiresAt !== 'permanently' ? `until ${expiresAt}` : 'permanently'}.${restriction.reason ? ` Reason: ${restriction.reason}` : ''}`);
            return;
          }
        } catch (restrictionError) {
          console.error('Error checking restriction:', restrictionError);
          // Continue with connection if check fails
        }

        // Set auto-connect flag for future sessions
        localStorage.setItem('wallet_auto_connect', 'true');

        // Track IP address when wallet connects
        try {
          const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
          await fetch(`${API_BASE_URL}/api/track-ip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: address })
          }).catch(err => {
            // Silently fail - IP tracking is not critical
            console.error('Failed to track IP on wallet connect:', err);
          });
        } catch (ipError) {
          // Silently fail - IP tracking is not critical
          console.error('Exception tracking IP on wallet connect:', ipError);
        }

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

  const disconnectWallet = useCallback(() => {
    try {
      const w: any = window as any;
      if (w.solana?.disconnect) {
        // Disconnect from Phantom
        w.solana.disconnect().catch(() => {
          // Ignore errors, but ensure state is cleared
        });
      }
    } catch {}

    // Remove auto-connect flag
    localStorage.removeItem('wallet_auto_connect');
    // Set explicit disconnect flag to prevent auto-reconnect on refresh
    localStorage.setItem('wallet_explicitly_disconnected', 'true');
    
    // Clear wallet state
    setWallet({ address: null, isConnected: false, isConnecting: false, provider: null });
    
    // Clear timeout on disconnect
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Reset activity timeout
  const resetActivityTimeout = useCallback(() => {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only set timeout if wallet is connected
    if (wallet.isConnected) {
      timeoutRef.current = setTimeout(() => {
        console.log('Session timeout - disconnecting wallet');
        disconnectWallet();
      }, SESSION_TIMEOUT);
    }
  }, [wallet.isConnected, disconnectWallet]);

  // Track user activity
  useEffect(() => {
    if (!wallet.isConnected) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      resetActivityTimeout();
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Start initial timeout
    resetActivityTimeout();

    return () => {
      // Cleanup event listeners
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [wallet.isConnected, resetActivityTimeout]);

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const signMessage = useCallback(async (message: string): Promise<{ signature: Uint8Array }> => {
    // Check our internal state
    if (!wallet.provider || !wallet.address) {
      // Double-check Phantom's actual connection state
      const w: any = window as any;
      if (w.solana && w.solana.isPhantom && w.solana.isConnected) {
        // Phantom says it's connected, but our state is stale - update it
        const address = w.solana.publicKey?.toString?.();
        if (address) {
          setWallet({ address, isConnected: true, isConnecting: false, provider: w.solana });
          // Use the fresh provider
          const ph = w.solana;
          try {
            const encodedMessage = new TextEncoder().encode(message);
            const signed = await ph.signMessage(encodedMessage, 'utf8');
            return { signature: signed.signature };
          } catch (error: any) {
            console.error('Error signing message:', error);
            if (error?.code === 4001 || error?.message?.includes('User rejected') || error?.message?.includes('canceled') || error?.message?.includes('denied')) {
              throw new Error('Signature request was canceled. Payment was not sent.');
            }
            throw new Error(error?.message || 'Failed to sign message. Please try again.');
          }
        }
      }
      throw new Error('Wallet not connected');
    }

    const ph = wallet.provider as any;
    if (!ph?.isPhantom || !ph.signMessage) {
      throw new Error('Phantom wallet not available or does not support message signing');
    }

    try {
      // Phantom's signMessage expects a Uint8Array
      // It automatically adds the Solana message prefix: "\xffSolana Signed Message:\n" + length + message
      const encodedMessage = new TextEncoder().encode(message);
      // This will trigger Phantom popup for signature
      // Phantom signs: "\xffSolana Signed Message:\n" + message length (u16) + message
      const signed = await ph.signMessage(encodedMessage, 'utf8');
      
      // Phantom returns { signature: Uint8Array }
      return {
        signature: signed.signature
      };
    } catch (error: any) {
      console.error('Error signing message:', error);
      // Check if user rejected/canceled the signature
      if (error?.code === 4001 || error?.message?.includes('User rejected') || error?.message?.includes('canceled') || error?.message?.includes('denied')) {
        throw new Error('Signature request was canceled. Payment was not sent.');
      }
      throw new Error(error?.message || 'Failed to sign message. Please try again.');
    }
  }, [wallet.provider, wallet.address]);

  const value: WalletContextValue = {
    ...wallet,
    connectWallet,
    disconnectWallet,
    formatAddress,
    signMessage,
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