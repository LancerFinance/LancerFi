import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Menu, X, User, MessageSquare, Plus, Shield, Zap, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import WalletButton from "./WalletButton";
import { useWallet } from "@/hooks/useWallet";
import { db } from "@/lib/supabase";
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dashboardNotificationCount, setDashboardNotificationCount] = useState(0);
  const {
    isConnected,
    address: connectedAddress
  } = useWallet();
  useEffect(() => {
    if (isConnected && connectedAddress) {
      checkUnreadMessages();
      checkDashboardNotifications();
      // Check for new messages and notifications every 10 seconds
      const interval = setInterval(() => {
        checkUnreadMessages();
        checkDashboardNotifications();
      }, 10000);

      // Listen for message read events to update count immediately
      const handleMessageRead = () => checkUnreadMessages();
      window.addEventListener('messageRead', handleMessageRead);
      return () => {
        clearInterval(interval);
        window.removeEventListener('messageRead', handleMessageRead);
      };
    } else {
      setUnreadCount(0);
      setDashboardNotificationCount(0);
    }
  }, [isConnected, connectedAddress]);
  const checkUnreadMessages = async () => {
    if (!connectedAddress) return;
    try {
      const messages = await db.getMessagesForUser(connectedAddress);
      const unread = messages.filter(msg => msg.recipient_id === connectedAddress && !msg.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  };
  const checkDashboardNotifications = async () => {
    if (!connectedAddress) return;
    try {
      const [proposalsCount, submissionsCount] = await Promise.all([
        db.getNewProposalsCount(connectedAddress),
        db.getNewWorkSubmissionsCount(connectedAddress)
      ]);
      setDashboardNotificationCount(proposalsCount + submissionsCount);
    } catch (error) {
      console.error('Error checking dashboard notifications:', error);
    }
  };
  return <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Top bar with announcement */}
        

        {/* Main header */}
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img src="/lancer-logo.png?v=2" alt="LancerFi Logo" className="h-6 sm:h-8 w-auto" />
          </Link>

          {/* Header Search (desktop) */}
          <div className="hidden lg:flex flex-1 mx-8">
            <div className="relative w-full max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/browse-services?search=${encodeURIComponent(searchTerm)}`); }}
                placeholder="Search services"
                className="pl-9 h-10 rounded-full bg-muted/60 hover:bg-muted/80 border-border"
                aria-label="Search services"
              />
            </div>
          </div>

          {/* Navigation Links - Desktop */}
          <nav className="hidden lg:flex items-center space-x-6 justify-end">
            <Link to="/dashboard" className="text-sm font-medium text-foreground hover:text-primary transition-colors relative inline-flex items-center">
              Dashboard
              {dashboardNotificationCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full leading-none">
                  {dashboardNotificationCount > 99 ? '99+' : dashboardNotificationCount}
                </span>
              )}
            </Link>
            <Link to="/browse-services" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Browse
            </Link>
            <Link to="/post-project" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Post Project
            </Link>
            <Link to="/hire-talent" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Find Talent
            </Link>
            <Link to="/how-it-works" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              How It Works
            </Link>
            <Link to="/faq" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              FAQs
            </Link>
            {connectedAddress && <>
                <Link to="/messages" className="text-sm font-medium text-foreground hover:text-primary transition-colors relative inline-flex items-center">
                  Messages
                  {unreadCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
                <Link to="/edit-profile" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                  Profile
                </Link>
              </>}
            <WalletButton />
          </nav>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 text-foreground">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Secondary Navigation Bar */}
        <div className="hidden lg:flex items-center justify-between py-3 border-t border-border/50">
          
          <span className="text-sm text-muted-foreground">SOL, USDC, X402 payments • Near-zero fees</span>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && <div className="lg:hidden pb-4 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-4">
              {/* Mobile search */}
              <div className="relative">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setIsMobileMenuOpen(false); navigate(`/browse-services?search=${encodeURIComponent(searchTerm)}`); } }}
                  placeholder="Search services"
                  className="pl-8 sm:pl-9 h-9 sm:h-10 text-xs sm:text-sm rounded-full bg-muted/60 border-border"
                  aria-label="Search services"
                />
              </div>

              {/* Main Navigation Links - Same as Desktop */}
              <div className="space-y-1">
                <Link to="/dashboard" className="flex items-center py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  <span className="relative inline-flex items-center">
                    Dashboard
                    {dashboardNotificationCount > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full leading-none">
                        {dashboardNotificationCount > 99 ? '99+' : dashboardNotificationCount}
                      </span>
                    )}
                  </span>
                </Link>
                <Link to="/browse-services" className="block py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Browse
                </Link>
                <Link to="/post-project" className="block py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Post Project
                </Link>
                <Link to="/hire-talent" className="block py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Find Talent
                </Link>
                <Link to="/how-it-works" className="block py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  How It Works
                </Link>
                <Link to="/faq" className="block py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  FAQs
                </Link>
                {connectedAddress && <>
                  <Link to="/messages" className="flex items-center py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                    <span className="relative inline-flex items-center">
                      Messages
                      {unreadCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 bg-destructive text-destructive-foreground text-[10px] font-semibold rounded-full leading-none">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </span>
                  </Link>
                  <Link to="/edit-profile" className="block py-2.5 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:text-primary hover:bg-muted/50 rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                    Profile
                  </Link>
                </>}
              </div>
              
              {/* Wallet Button */}
              <div className="border-t border-border pt-4">
                <WalletButton variant="default" className="w-full justify-center" />
              </div>
            </nav>
          </div>}
      </div>
    </header>;
};
export default Header;