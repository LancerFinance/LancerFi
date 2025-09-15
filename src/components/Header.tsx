import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, User } from "lucide-react";
import { Link } from "react-router-dom";
import WalletButton from "./WalletButton";
import { useWallet } from "@/hooks/useWallet";

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isConnected } = useWallet();

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">W3</span>
            </div>
            <span className="text-xl font-bold text-foreground">Web3Lance</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link to="/hire-talent" className="text-muted-foreground hover:text-foreground transition-colors">
              Hire Talent
            </Link>
            <Link to="/freelancer" className="text-muted-foreground hover:text-foreground transition-colors">
              Find Work
            </Link>
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            {isConnected && (
              <Link to="/edit-profile">
                <Button variant="ghost" className="text-muted-foreground">
                  <User className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            )}
            <Link to="/freelancer">
              <Button variant="ghost" className="text-muted-foreground">
                Find Work
              </Button>
            </Link>
            <WalletButton className="animate-glow" />
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
          <div className="md:hidden mt-4 pb-4 border-t border-border pt-4">
            <nav className="flex flex-col space-y-4">
              <Link 
                to="/how-it-works" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                How It Works
              </Link>
              <Link 
                to="/hire-talent" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Hire Talent
              </Link>
              <Link 
                to="/freelancer" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Find Work
              </Link>
              <Link 
                to="/dashboard" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link 
                to="/faq" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                FAQ
              </Link>
              <div className="flex flex-col space-y-2 pt-4">
                {isConnected && (
                  <Link to="/edit-profile">
                    <Button variant="ghost" className="justify-start">
                      <User className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                )}
                <Link to="/freelancer">
                  <Button variant="ghost" className="justify-start">
                    Find Work
                  </Button>
                </Link>
                <WalletButton variant="corporate" className="justify-start" />
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;