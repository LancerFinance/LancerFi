import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, X, User, MessageSquare, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import WalletButton from "./WalletButton";
import { useWallet } from "@/hooks/useWallet";
import { db } from "@/lib/supabase";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isConnected, address } = useWallet();

  useEffect(() => {
    if (isConnected && address) {
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
  }, [isConnected, address]);

  const checkUnreadMessages = async () => {
    if (!address) return;
    
    try {
      const messages = await db.getMessagesForUser(address);
      const unread = messages.filter(msg => 
        msg.recipient_id === address && !msg.is_read
      ).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  };

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">W3</span>
            </div>
            <span className="text-lg sm:text-xl font-bold text-foreground hidden xs:block">LancerFi</span>
            <span className="text-lg sm:text-xl font-bold text-foreground xs:hidden">W3L</span>
          </Link>

          {/* Tablet Navigation */}
          <nav className="hidden lg:flex items-center space-x-6 xl:space-x-8">
            <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              How It Works
            </Link>
            <Link to="/browse-services" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Browse Services
            </Link>
            <Link to="/hire-talent" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Hire Talent
            </Link>
            <Link to="/freelancer" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Find Work
            </Link>
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Dashboard
            </Link>
            <Link to="/messages" className="text-muted-foreground hover:text-foreground transition-colors relative text-sm">
              Messages
              {unreadCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-4 w-4 text-xs bg-destructive text-destructive-foreground p-0 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Link>
            <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              FAQ
            </Link>
          </nav>

          {/* Compact Navigation for medium screens */}
          <nav className="hidden md:flex lg:hidden items-center space-x-4">
            <Link to="/browse-services" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Browse
            </Link>
            <Link to="/hire-talent" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
              Hire
            </Link>
            <Link to="/messages" className="text-muted-foreground hover:text-foreground transition-colors relative text-sm">
              <MessageSquare className="w-4 h-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-3 w-3 text-xs bg-destructive text-destructive-foreground p-0 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center space-x-3 xl:space-x-4">
            {isConnected && (
              <Link to="/edit-profile">
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  <User className="w-4 h-4 mr-2" />
                  <span className="hidden xl:inline">Edit Profile</span>
                  <span className="xl:hidden">Profile</span>
                </Button>
              </Link>
            )}
            <Link to="/freelancer">
              <Button variant="ghost" size="sm" className="text-muted-foreground hidden xl:flex">
                Find Work
              </Button>
            </Link>
            <Link to="/post-project">
              <Button variant="outline" size="sm" className="text-primary border-primary hover:bg-primary hover:text-primary-foreground">
                <Plus className="w-4 h-4 mr-1 xl:mr-2" />
                <span className="hidden sm:inline">Post</span>
                <span className="hidden xl:inline"> Project</span>
              </Button>
            </Link>
            <WalletButton className="animate-glow" />
          </div>

          {/* Tablet CTA */}
          <div className="hidden md:flex lg:hidden items-center space-x-2">
            <Link to="/post-project">
              <Button variant="outline" size="sm" className="text-primary border-primary hover:bg-primary hover:text-primary-foreground">
                <Plus className="w-4 h-4" />
              </Button>
            </Link>
            <WalletButton variant="corporate" className="text-xs px-2" />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-200">
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
                <Link 
                  to="/how-it-works" 
                  className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  How It Works
                </Link>
                <Link 
                  to="/freelancer" 
                  className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Find Work
                </Link>
                <Link 
                  to="/dashboard" 
                  className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/messages" 
                  className="flex items-center py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Messages
                  {unreadCount > 0 && (
                    <Badge className="ml-auto h-5 w-5 text-xs bg-destructive text-destructive-foreground p-0 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Link>
                <Link 
                  to="/faq" 
                  className="block py-2 px-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-sm"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
              </div>
              
              <div className="border-t border-border pt-4 mt-4 space-y-2">
                {isConnected && (
                  <Link to="/edit-profile" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <User className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                )}
                <Link to="/post-project" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Plus className="w-4 h-4 mr-2" />
                    Post Project
                  </Button>
                </Link>
                <div className="pt-2">
                  <WalletButton variant="corporate" className="w-full justify-start" />
                </div>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;