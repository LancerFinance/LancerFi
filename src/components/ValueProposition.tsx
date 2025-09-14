import { Card, CardContent } from "@/components/ui/card";
import { Shield, DollarSign, Zap, Globe, Award, Lock } from "lucide-react";

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
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
            Why Choose Our Platform?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium">
            Traditional freelance platforms weren't built for Web3. We solve the core problems of trust, 
            fees, and global payments with blockchain-native solutions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => (
            <Card key={index} className="bg-card border border-border shadow-card hover:shadow-corporate transition-all duration-300 group">
              <CardContent className="p-8">
                <div className="mb-6">
                  <div className="w-16 h-16 bg-web3-primary/10 rounded-lg flex items-center justify-center text-web3-primary mb-4">
                    {benefit.icon}
                  </div>
                  <div className="inline-flex items-center px-3 py-1 bg-web3-primary/10 rounded-md mb-4">
                    <span className="text-web3-primary text-sm font-semibold">
                      {benefit.highlight}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-4 text-foreground">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="bg-web3-primary rounded-lg p-12 text-center max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-white mb-6">
              Ready to Experience Web3 Freelancing?
            </h3>
            <p className="text-white/90 text-xl mb-8 max-w-2xl mx-auto font-medium">
              Join the future of work where smart contracts handle escrow, USDC enables global payments, 
              and your reputation is permanently verifiable on-chain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-web3-primary px-10 py-4 rounded-lg font-bold text-lg hover:bg-gray-50 transition-colors">
                Start Hiring Now
              </button>
              <button className="border-2 border-white/30 text-white px-10 py-4 rounded-lg font-bold text-lg hover:bg-white/10 transition-colors">
                Browse Talent
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;