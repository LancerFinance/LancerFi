import { Shield, DollarSign, Zap, Globe, Award, Lock } from "lucide-react";
import { Link } from "react-router-dom";

const ValueProposition = () => {
  const benefits = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Trustless Escrow",
      description: "Solana smart contracts eliminate counterparty risk. No disputes, no chargebacks, no manual intervention required.",
      highlight: "Zero Trust Issues"
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: "Near-Zero Fees",
      description: "Traditional platforms charge 20-30%. We charge minimal fees thanks to Solana's efficient architecture.",
      highlight: "Save 90% on Fees"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Instant Settlements",
      description: "USDC payments settle in seconds on Solana. No waiting days for international wire transfers.",
      highlight: "Global Speed"
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Crypto-First Design",
      description: "Built for the Web3 economy. No fiat conversion fees, no banking delays, true borderless commerce.",
      highlight: "Native Web3"
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: "On-Chain Reputation",
      description: "Portable reputation system with NFT badges and immutable reviews. Your track record follows you.",
      highlight: "Verifiable History"
    },
    {
      icon: <Lock className="w-8 h-8" />,
      title: "Community Owned",
      description: "Future governance via platform token and DAO. Users shape the platform's evolution and share in success.",
      highlight: "Decentralized Future"
    }
  ];

  return (
    <section className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 fade-in">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
            Why Choose Our Platform?
          </h2>
          <p className="text-base text-muted-foreground max-w-3xl mx-auto">
            Traditional freelance platforms weren't built for Web3. We solve the core problems of trust, 
            fees, and global payments with blockchain-native solutions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={index} 
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/20 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 hover-lift fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-6">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground mb-4 shadow-lg">
                  {benefit.icon}
                </div>
                <div className="inline-flex items-center px-3 py-1 bg-secondary/80 rounded-full mb-4 border border-border">
                  <span className="text-foreground text-sm font-semibold">
                    {benefit.highlight}
                  </span>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-3 text-foreground">
                {benefit.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {benefit.description}
              </p>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mb-12"></div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16 fade-in">
          <div className="relative overflow-hidden bg-primary rounded-2xl p-12 text-center max-w-4xl mx-auto shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <h3 className="text-2xl sm:text-3xl font-bold text-primary-foreground mb-4">
              Ready to Experience Web3 Freelancing?
            </h3>
            <p className="text-primary-foreground/90 text-base mb-8 max-w-2xl mx-auto">
              Join the future of work where smart contracts handle escrow, USDC enables global payments, 
              and your reputation is permanently verifiable on-chain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/post-project" 
                className="bg-background text-foreground px-10 py-4 rounded-lg font-bold text-base hover:bg-background/90 transition-colors ripple inline-flex items-center justify-center shadow-lg" 
                role="button" 
                aria-label="Start Hiring Now"
              >
                Start Hiring Now
              </Link>
              <Link 
                to="/hire-talent" 
                className="border-2 border-primary-foreground text-primary-foreground px-10 py-4 rounded-lg font-bold text-base hover:bg-primary-foreground/10 transition-colors ripple inline-flex items-center justify-center" 
                role="button" 
                aria-label="Browse Talent"
              >
                Browse Talent
              </Link>
            </div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-primary-foreground/5 rounded-full -mr-20 -mb-20"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;