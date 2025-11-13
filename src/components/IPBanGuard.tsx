/**
 * IP Ban Guard Component
 * Checks if the user's IP is banned and blocks access to the entire app
 * If banned, keeps the page in a perpetual loading state
 */

import { useEffect, useState, ReactNode } from 'react';

interface IPBanGuardProps {
  children: ReactNode;
}

export const IPBanGuard = ({ children }: IPBanGuardProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

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
        });

        if (!isMounted) return;

        if (response.status === 403) {
          // IP is banned - keep checking in a loop to prevent access
          setIsBanned(true);
          setIsChecking(true); // Keep in loading state forever
          
          // Continue checking in a loop to ensure ban persists
          checkInterval = setInterval(() => {
            checkIPBan();
          }, 2000); // Check every 2 seconds
          return;
        } else if (response.ok) {
          // Check response body to see if IP is banned
          const data = await response.json().catch(() => ({}));
          if (data.isRestricted && data.restrictionType === 'ban_ip') {
            // IP is banned - keep checking in a loop to prevent access
            setIsBanned(true);
            setIsChecking(true); // Keep in loading state forever
            
            // Continue checking in a loop to ensure ban persists
            checkInterval = setInterval(() => {
              checkIPBan();
            }, 2000); // Check every 2 seconds
            return;
          }
        }
        
        // IP is not banned - allow access
        if (isMounted) {
          setIsBanned(false);
          setIsChecking(false);
        }
      } catch (error) {
        // On error, check again after a delay (fail closed for security)
        if (isMounted) {
          setTimeout(() => {
            checkIPBan();
          }, 2000);
        }
      }
    };

    // Initial check
    checkIPBan();

    // Cleanup
    return () => {
      isMounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  // If banned, show perpetual loading screen (never allow access)
  if (isBanned || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // IP is not banned, render children
  return <>{children}</>;
};

