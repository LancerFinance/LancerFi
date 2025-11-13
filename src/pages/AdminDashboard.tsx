import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Activity, Briefcase, Users } from "lucide-react";
import AdminMessages from "@/components/admin/AdminMessages";
import AdminSystemStatus from "@/components/admin/AdminSystemStatus";
import AdminProjects from "@/components/admin/AdminProjects";
import AdminUsers from "@/components/admin/AdminUsers";
import NotFound from "./NotFound";
import { useWallet } from "@/hooks/useWallet";

type AdminSection = 'messages' | 'system' | 'projects' | 'users';

// Admin wallet address - must match exactly
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<AdminSection>('messages');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const { address, isConnected } = useWallet();

  const sections = [
    { id: 'messages' as AdminSection, label: 'Messages', icon: MessageSquare },
    { id: 'system' as AdminSection, label: 'System Status', icon: Activity },
    { id: 'projects' as AdminSection, label: 'Projects', icon: Briefcase },
    { id: 'users' as AdminSection, label: 'Users', icon: Users },
  ];

  const verifyAdminAccess = useCallback(async () => {
    setIsVerifying(true);
    
    try {
      // Check wallet connection status - use both hook and direct Phantom check
      const w: any = window as any;
      let walletAddress: string | null = null;
      let walletConnected = false;
      
      // First, check the useWallet hook (most reliable)
      if (isConnected && address) {
        walletAddress = address;
        walletConnected = true;
      }
      
      // Also check Phantom directly as fallback
      if (!walletAddress && w.solana && w.solana.isPhantom) {
        if (w.solana.isConnected && w.solana.publicKey) {
          walletAddress = w.solana.publicKey.toString();
          walletConnected = true;
        } else if (w.solana.publicKey) {
          // Sometimes publicKey exists even if isConnected is false
          walletAddress = w.solana.publicKey.toString();
          walletConnected = true;
        }
      }
      
      // CRITICAL: If wallet is NOT connected, deny access immediately
      if (!walletConnected || !walletAddress) {
        setIsAuthorized(false);
        setIsVerifying(false);
        return;
      }

      // Normalize addresses for comparison
      const normalizedAddress = typeof walletAddress === 'string' ? walletAddress.trim() : String(walletAddress).trim();
      const normalizedAdminAddress = ADMIN_WALLET_ADDRESS.trim();

      // Simple check: Wallet address must match admin wallet exactly
      // NO SIGNATURE REQUIRED - just check if connected wallet matches admin wallet
      if (normalizedAddress === normalizedAdminAddress) {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    } catch (error: any) {
      // Silently deny access on any error
      setIsAuthorized(false);
    } finally {
      setIsVerifying(false);
    }
  }, [address, isConnected]);

  // Verify admin access on mount and when wallet changes
  // Also re-verify periodically to prevent state manipulation
  useEffect(() => {
    verifyAdminAccess();
    
    // Re-verify every 2 seconds to prevent state manipulation attacks
    const interval = setInterval(() => {
      verifyAdminAccess();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [verifyAdminAccess]);

  // CRITICAL SECURITY: Always re-verify before rendering admin content
  // This prevents state manipulation attacks via React DevTools
  useEffect(() => {
    if (isAuthorized) {
      // Double-check authorization on every state change
      const w: any = window as any;
      let currentAddress: string | null = null;
      
      // Always verify from Phantom directly, not just React state
      if (isConnected && address) {
        currentAddress = address;
      } else if (w.solana && w.solana.isPhantom && w.solana.isConnected && w.solana.publicKey) {
        currentAddress = w.solana.publicKey.toString();
      }
      
      // If wallet doesn't match admin, revoke access immediately
      if (!currentAddress || currentAddress.trim() !== ADMIN_WALLET_ADDRESS.trim()) {
        setIsAuthorized(false);
      }
    }
  }, [isAuthorized, isConnected, address]);

  // Show loading state while verifying
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show 404 if not authorized (but still show header)
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <NotFound />
      </div>
    );
  }

         return (
           <div className="min-h-screen bg-background">
             <Header />
      <main className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 sm:mb-8">
            Admin Dashboard
          </h1>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
            {sections.map((section) => {
              const Icon = section.icon;
              const isMessages = section.id === 'messages';
              return (
                <div key={section.id} className="relative">
                  <Button
                    variant={activeSection === section.id ? 'default' : 'outline'}
                    className="h-auto py-4 sm:py-6 flex flex-col items-center gap-2 sm:gap-3 w-full"
                    onClick={() => setActiveSection(section.id)}
                  >
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-xs sm:text-sm font-medium">{section.label}</span>
                  </Button>
                  {isMessages && unreadSupportCount > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 bg-destructive rounded-full border-2 border-background"></span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Content Section */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              {activeSection === 'messages' && <AdminMessages onSupportCountChange={setUnreadSupportCount} />}
              {activeSection === 'system' && <AdminSystemStatus />}
              {activeSection === 'projects' && <AdminProjects />}
              {activeSection === 'users' && <AdminUsers />}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

