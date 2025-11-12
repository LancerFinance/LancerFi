/**
 * IP Ban Guard Component
 * Checks if the user's IP is banned and blocks access to the entire app
 */

import { useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IPBanGuardProps {
  children: ReactNode;
}

export const IPBanGuard = ({ children }: IPBanGuardProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const [banInfo, setBanInfo] = useState<{
    expiresAt: string | null;
    reason: string | null;
  } | null>(null);

  useEffect(() => {
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
        });

        if (response.status === 403) {
          // IP is banned
          const data = await response.json().catch(() => ({}));
          setIsBanned(true);
          setBanInfo({
            expiresAt: data.expiresAt || null,
            reason: data.reason || null,
          });
          return; // Stop here, don't set isChecking to false yet
        } else if (response.ok) {
          // Check response body to see if IP is banned
          const data = await response.json().catch(() => ({}));
          if (data.isRestricted && data.restrictionType === 'ban_ip') {
            setIsBanned(true);
            setBanInfo({
              expiresAt: data.expiresAt || null,
              reason: data.reason || null,
            });
            return;
          }
        } else {
          // Error checking, but allow access (fail open)
          console.error('Error checking IP ban:', response.status);
        }
      } catch (error) {
        // Error checking, but allow access (fail open)
        console.error('Exception checking IP ban:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkIPBan();
  }, []);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show ban message if IP is banned
  if (isBanned) {
    const expiresText = banInfo?.expiresAt
      ? ` until ${new Date(banInfo.expiresAt).toLocaleString()}`
      : ' permanently';
    const reasonText = banInfo?.reason ? ` Reason: ${banInfo.reason}` : '';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-3xl font-bold text-destructive">Access Denied</h1>
          <p className="text-lg text-muted-foreground">
            Your IP address has been banned from accessing this service{expiresText}.{reasonText}
          </p>
          {banInfo?.expiresAt && (
            <p className="text-sm text-muted-foreground mt-4">
              Ban expires: {new Date(banInfo.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  // IP is not banned, render children
  return <>{children}</>;
};

