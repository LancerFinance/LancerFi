import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, Palette, TrendingUp, Users, Coins, Zap } from "lucide-react";

const JobCategories = () => {
  const categories = [
    {
      icon: <Code className="w-8 h-8" />,
      title: "Smart Contract Developers",
      description: "Solidity, Rust/Anchor, audits, and security reviews",
      demand: "High Demand",
      color: "web3-primary"
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Web3 Full-Stack Developers", 
      description: "dApps, Solana Pay integrations, and DeFi protocols",
      demand: "Very High",
      color: "web3-secondary"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Crypto Marketers",
      description: "Twitter growth, Discord management, community building",
      demand: "High Demand",
      color: "web3-accent"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "DAO Managers",
      description: "Governance, proposals, community moderation",
      demand: "Growing",
      color: "web3-success"
    },
    {
      icon: <Coins className="w-8 h-8" />,
      title: "Token Economists",
      description: "Tokenomics design, staking models, liquidity strategies",
      demand: "Very High",
      color: "web3-warning"
    },
    {
      icon: <Palette className="w-8 h-8" />,
      title: "NFT Artists & Strategists",
      description: "Collection design, minting strategies, roadmap planning",
      demand: "High Demand",
      color: "web3-neutral"
    }
  ];

  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
            In-Demand Web3 Specialties
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium">
            Connect with experts across the most sought-after Web3 skills. From smart contract development 
            to DAO management, find talent that understands your project's unique requirements.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {categories.map((category, index) => (
            <Card key={index} className="bg-card border border-border shadow-card hover:shadow-corporate transition-all duration-300 group">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4 mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center transition-transform duration-300 ${
                    category.color === 'web3-primary' ? 'bg-web3-primary/10 text-web3-primary' :
                    category.color === 'web3-secondary' ? 'bg-web3-secondary/10 text-web3-secondary' :
                    category.color === 'web3-accent' ? 'bg-web3-accent/10 text-web3-accent' :
                    category.color === 'web3-success' ? 'bg-web3-success/10 text-web3-success' :
                    category.color === 'web3-warning' ? 'bg-web3-warning/10 text-web3-warning' :
                    'bg-web3-neutral/10 text-web3-neutral'
                  }`}>
                    {category.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-foreground">
                        {category.title}
                      </h3>
                      <span className="text-xs px-2 py-1 bg-web3-primary/20 text-web3-primary rounded-full font-medium">
                        {category.demand}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </section>
  );
};

export default JobCategories;