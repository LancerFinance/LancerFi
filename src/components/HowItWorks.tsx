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
    <section className="py-20 mb-16 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 fade-in">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 text-foreground tracking-tight">
            Trustless. Fast. Professional.
          </h2>
          <p className="text-base text-muted-foreground max-w-3xl mx-auto">
            Built on Solana for speed and scalability. Smart contract escrow eliminates middlemen, 
            reduces fees to near-zero, and ensures global payments in seconds, not days.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <div
              key={index} 
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/20 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 text-center hover-lift fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-6 relative inline-block">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
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
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mb-12"></div>
            </div>
          ))}
        </div>

        <div className="text-center mt-16 fade-in">
          <div className="inline-flex items-center space-x-2 bg-secondary rounded-full px-6 py-3 border border-border shadow-md">
            <Lock className="w-5 h-5 text-foreground" />
            <span className="text-foreground font-medium">Powered by Solana Smart Contracts</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;