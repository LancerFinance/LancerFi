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
  // Start with checking=true to block ALL rendering until check completes
  const [isChecking, setIsChecking] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let checkInterval: NodeJS.Timeout | null = null;

    const checkIPBan = async () => {
      try {
        // Get user's IP address (we'll use a backend endpoint to get it)
        const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
        
        // Check IP ban status via backend (no parameters = checks request IP)
        const response = await fetch(`${API_BASE_URL}/api/admin/check-restriction`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          // Add cache-busting to prevent cached responses
          cache: 'no-store',
          // Add timestamp to prevent caching
          credentials: 'omit',
        });

        if (!isMounted) return;

        if (response.status === 403) {
          // IP is banned - NEVER allow access
          setIsBanned(true);
          setIsChecking(true); // Keep in loading state forever
          setHasChecked(true);
          
          // Continue checking in a loop to ensure ban persists
          if (checkInterval) {
            clearInterval(checkInterval);
          }
          checkInterval = setInterval(() => {
            if (isMounted) {
              checkIPBan();
            }
          }, 2000); // Check every 2 seconds
          return;
        } else if (response.ok) {
          // Check response body to see if IP is banned
          const data = await response.json().catch(() => ({}));
          if (data.isRestricted && data.restrictionType === 'ban_ip') {
            // IP is banned - NEVER allow access
            setIsBanned(true);
            setIsChecking(true); // Keep in loading state forever
            setHasChecked(true);
            
            // Continue checking in a loop to ensure ban persists
            if (checkInterval) {
              clearInterval(checkInterval);
            }
            checkInterval = setInterval(() => {
              if (isMounted) {
                checkIPBan();
              }
            }, 2000); // Check every 2 seconds
            return;
          }
        }
        
        // IP is not banned - allow access ONLY after check completes
        if (isMounted) {
          setIsBanned(false);
          setIsChecking(false);
          setHasChecked(true);
        }
      } catch (error) {
        // On error, keep checking (fail closed for security - block access)
        if (isMounted) {
          setIsChecking(true); // Keep checking
          setTimeout(() => {
            if (isMounted) {
              checkIPBan();
            }
          }, 2000);
        }
      }
    };

    // Initial check - BLOCK ALL RENDERING until this completes
    checkIPBan();

    // Cleanup
    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  // CRITICAL: If checking OR banned, show ONLY loading screen - NEVER render children
  // This blocks ALL content from rendering
  if (isChecking || isBanned || !hasChecked) {
    return (
      <>
        {/* Block ALL content with a full-screen overlay */}
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
        {/* Prevent any children from rendering by returning null */}
        {null}
      </>
    );
  }

  // ONLY render children if check completed AND not banned
  return <>{children}</>;
};

