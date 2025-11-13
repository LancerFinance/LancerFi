/**
 * IP Ban Guard Component
 * Checks if the user's IP is banned and blocks access to the entire app
 * If banned, keeps the page in a perpetual loading state - NEVER renders content
 */

import { useEffect, useState, ReactNode } from 'react';

interface IPBanGuardProps {
  children: ReactNode;
}

export const IPBanGuard = ({ children }: IPBanGuardProps) => {
  // Start with checking=false since index.html already checked before React loaded
  // Only show loading if we detect a ban during periodic checks
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout | null = null;

    const checkIPBan = async () => {
      try {
        const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
        
        // Check IP ban status (lightweight background check)
        const response = await fetch(`${API_BASE_URL}/api/admin/check-restriction?t=${Date.now()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          credentials: 'omit',
        });

        if (!isMounted) return;

        if (response.status === 403) {
          // IP is banned - block access
          setIsBanned(true);
          
          // Continue checking periodically
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          checkInterval = setInterval(() => {
            if (isMounted) {
              checkIPBan();
            }
          }, 2000);
          return;
        } else if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.isRestricted && data.restrictionType === 'ban_ip') {
            // IP is banned - block access
            setIsBanned(true);
            
            // Continue checking periodically
            if (checkInterval) {
              clearInterval(checkInterval);
            }
            checkInterval = setInterval(() => {
              if (isMounted) {
                checkIPBan();
              }
            }, 2000);
            return;
          }
        }
        
        // IP is not banned - allow access
        if (isMounted) {
          setIsBanned(false);
        }
      } catch (error) {
        // On error, fail open (don't block) since index.html already checked
        // Continue silently
      }
    };

    // Do a quick background check (non-blocking)
    // Don't block initial render since index.html already checked
    checkIPBan();
    
    // Periodic checks every 10 seconds (less frequent than banned users)
    checkInterval = setInterval(() => {
      if (isMounted) {
        checkIPBan();
      }
    }, 10000);

    // Cleanup
    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  // Only block if actually banned (index.html should have caught this, but this is a fallback)
  if (isBanned) {
    return (
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999999,
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Render children normally (no blocking on initial load)
  return <>{children}</>;
};

