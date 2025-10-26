import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, Lock, CreditCard } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: <FileText className="w-8 h-8" />,
      title: "Post Web3 Project",
      description: "Define your smart contract, DeFi, NFT, or DAO project with clear requirements. Set budget in USDC for global accessibility.",
      color: "web3-primary"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Connect with Specialists",
      description: "Receive proposals from verified Solana developers, token economists, DAO managers, and crypto marketers with proven track records.",
      color: "web3-secondary"
    },
    {
      icon: <Lock className="w-8 h-8" />,
      title: "Solana Escrow Lock",
      description: "USDC funds automatically locked in Solana smart contract. Trustless protection with programmable release conditions.",
      color: "web3-success"
    },
    {
      icon: <CreditCard className="w-8 h-8" />,
      title: "Instant Settlement",
      description: "Work approved? Smart contract instantly releases USDC payment on Solana. Low fees, global speed, complete transparency.",
      color: "web3-warning"
    }
  ];

  return (
    <section className="py-16 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 fade-in">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
            Trustless. Fast. Professional.
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Built on Solana for speed and scalability. Smart contract escrow eliminates middlemen, 
            reduces fees to near-zero, and ensures global payments in seconds, not days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <Card 
              key={index} 
              className="bg-card border border-border hover-lift fade-in hover:shadow-lg"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-8 text-center">
                <div className="mb-6 relative">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-primary flex items-center justify-center text-primary-foreground transition-transform duration-300">
                    {step.icon}
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-foreground rounded-full flex items-center justify-center text-background text-sm font-bold">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-4 text-foreground">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-16 fade-in">
          <div className="inline-flex items-center space-x-2 bg-secondary rounded-full px-6 py-3 border border-border">
            <Lock className="w-5 h-5 text-foreground" />
            <span className="text-foreground font-medium">Powered by Solana Smart Contracts</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;