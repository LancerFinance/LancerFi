/// <reference types="vite/client" />

interface Window {
  solana?: {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    disconnect: () => void;
    on: (event: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (event: string) => void;
    publicKey?: { toString: () => string };
    isConnected?: boolean;
  };
}
