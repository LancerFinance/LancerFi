import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, User, MessageSquare, Plus, Shield, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";
import WalletButton from "./WalletButton";
import { useWallet } from "@/hooks/useWallet";
import { db } from "@/lib/supabase";
const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const {
    isConnected,
    address: connectedAddress
  } = useWallet();
  useEffect(() => {
    if (isConnected && connectedAddress) {
      checkUnreadMessages();
      // Check for new messages every 30 seconds
      const interval = setInterval(checkUnreadMessages, 30000);

      // Listen for message read events to update count immediately
      const handleMessageRead = () => checkUnreadMessages();
      window.addEventListener('messageRead', handleMessageRead);
      return () => {
        clearInterval(interval);
        window.removeEventListener('messageRead', handleMessageRead);
      };
    } else {
      setUnreadCount(0);
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
  return <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar with announcement */}
        

        {/* Main header */}
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img src="/lancer-logo.png?v=2" alt="LancerFi Logo" className="h-8 w-auto" />
          </Link>

          {/* Navigation Links - Desktop */}
          <nav className="hidden lg:flex items-center space-x-6 flex-1 justify-end">
            <Link to="/dashboard" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              Dashboard
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
                <Link to="/messages" className="text-sm font-medium text-foreground hover:text-primary transition-colors relative">
                  Messages
                  {unreadCount > 0 && <span className="absolute -top-1 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount}
                    </span>}
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
          <div className="flex items-center space-x-6">
            <Link to="/browse-services?category=blockchain" className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Zap className="h-4 w-4" />
              <span>Blockchain Dev</span>
            </Link>
            <Link to="/browse-services?category=smart-contracts" className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Shield className="h-4 w-4" />
              <span>Smart Contracts</span>
            </Link>
            <Link to="/browse-services?category=defi" className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Users className="h-4 w-4" />
              <span>DeFi</span>
            </Link>
            <Link to="/browse-services?category=nft" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              NFTs
            </Link>
            <Link to="/browse-services?category=web3-frontend" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Web3 Frontend
            </Link>
          </div>
          <span className="text-sm text-muted-foreground">USDC payments • Near-zero fees</span>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && <div className="lg:hidden pb-4 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-3">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Link to="/browse-services" className="p-3 rounded-lg bg-muted/50 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Browse Services
                </Link>
                <Link to="/hire-talent" className="p-3 rounded-lg bg-muted/50 text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  Hire Talent
                </Link>
              </div>
              <div className="space-y-2">
                <Link to="/how-it-works" className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                  How It Works
                </Link>
                <Link to="/freelancer" className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                  Find Work
                </Link>
                <Link to="/dashboard" className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                  Dashboard
                </Link>
                <Link to="/messages" className="flex items-center py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Messages
                  {unreadCount > 0 && <Badge className="ml-auto h-5 w-5 text-xs bg-destructive text-destructive-foreground p-0 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>}
                </Link>
                <Link to="/faq" className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm" onClick={() => setIsMobileMenuOpen(false)}>
                  FAQ
                </Link>
              </div>
              
              <div className="border-t border-border pt-4 mt-4 space-y-2">
                {isConnected && <Link to="/edit-profile" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <User className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>}
                <Link to="/post-project" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Plus className="w-4 h-4 mr-2" />
                    Post Project
                  </Button>
                </Link>
                <div className="pt-2">
                  <WalletButton variant="default" className="w-full justify-start" />
                </div>
              </div>
            </nav>
          </div>}
      </div>
    </header>;
};
export default Header;