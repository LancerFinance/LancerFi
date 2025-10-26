import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Users } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-secondary/30 overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="container mx-auto px-4 text-center relative z-10 py-20">
        <div className="max-w-4xl mx-auto animate-fade-in">
          {/* Main Headline */}
          <h1 className="text-5xl md:text-6xl font-bold mb-8 text-foreground leading-tight tracking-tight">
            The Web3 Freelance
            <br />
            <span className="text-web3-primary">Marketplace on Solana</span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-xl text-muted-foreground mb-12 max-w-4xl mx-auto leading-relaxed font-medium">
            Crypto-native Fiverr alternative. Trustless escrow, USDC payments, and near-zero fees. 
            Connect with specialized Web3 talent for smart contracts, DeFi, NFTs, and DAO projects.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/post-project">
              <Button size="lg" variant="default" className="text-base px-10 py-4 font-semibold">
                Post a Project
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/hire-talent">
              <Button size="lg" variant="outline" className="text-base px-10 py-4 font-semibold border-2">
                Browse Talent
                <Users className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/create-freelancer-profile">
              <Button size="lg" variant="default" className="text-base px-10 py-4 font-semibold">
                Become a Freelancer
                <Users className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-3 p-6 bg-card rounded-lg border border-border shadow-sm">
              <Shield className="w-6 h-6 text-web3-primary" />
              <span className="text-base font-semibold text-foreground">Solana Smart Contract Escrow</span>
            </div>
            <div className="flex items-center justify-center space-x-3 p-6 bg-card rounded-lg border border-border shadow-sm">
              <Zap className="w-6 h-6 text-web3-primary" />
              <span className="text-base font-semibold text-foreground">USDC Instant Payments</span>
            </div>
            <div className="flex items-center justify-center space-x-3 p-6 bg-card rounded-lg border border-border shadow-sm">
              <Users className="w-6 h-6 text-web3-primary" />
              <span className="text-base font-semibold text-foreground">Near-Zero Platform Fees</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;