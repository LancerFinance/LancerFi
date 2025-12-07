import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, Target, TrendingUp, Users, Coins } from "lucide-react";

const Roadmap = () => {
  const phases = [
    {
      phase: "Phase 1",
      timeline: "Months 1–2",
      title: "Foundation & Token Launch",
      description: "Token launch via Pump.fun + escrow smart contract prototype.",
      status: "current",
      icon: <Coins className="w-6 h-6" />
    },
    {
      phase: "Phase 2", 
      timeline: "Months 3–4",
      title: "MVP Development",
      description: "MVP build → wallet login, job posting, profiles, escrow payments, reviews.",
      status: "upcoming",
      icon: <Target className="w-6 h-6" />
    },
    {
      phase: "Phase 3",
      timeline: "Month 5", 
      title: "Beta Testing & Security",
      description: "Beta testing, security checks, refine UX.",
      status: "planned",
      icon: <CheckCircle className="w-6 h-6" />
    },
    {
      phase: "Phase 4",
      timeline: "Month 6",
      title: "Public Launch",
      description: "Public launch → marketing push, token rewards for early adopters.",
      status: "planned", 
      icon: <TrendingUp className="w-6 h-6" />
    }
  ];

  const strategies = [
    {
      title: "Target Market",
      description: "DAOs, NFT projects, DeFi protocols, and Solana-based startups.",
      icon: <Users className="w-6 h-6" />
    },
    {
      title: "Adoption Flywheel", 
      description: "Every job = escrow locked = trading volume → platform token buybacks/burns.",
      icon: <TrendingUp className="w-6 h-6" />
    },
    {
      title: "Future Expansion",
      description: "Later add yield-on-escrow (funds earn interest while locked), DAO work collectives, and advanced token utilities (staking, governance).",
      icon: <Target className="w-6 h-6" />
    }
  ];

  return (
    <section className="py-24 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* MVP Roadmap */}
        <div className="mb-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
              MVP Roadmap
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium">
              Our strategic development timeline from token launch to full platform deployment. 
              Building the future of Web3 freelancing step by step.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {phases.map((phase, index) => (
              <Card key={index} className={`relative overflow-hidden transition-all duration-300 shadow-card hover:shadow-corporate ${
                phase.status === 'current' ? 'border-web3-primary bg-web3-primary/5' :
                phase.status === 'upcoming' ? 'border-web3-secondary/50 hover:border-web3-secondary' :
                'border-border hover:border-web3-primary/30'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg ${
                      phase.status === 'current' ? 'bg-web3-primary/20 text-web3-primary' :
                      phase.status === 'upcoming' ? 'bg-web3-secondary/20 text-web3-secondary' :
                      'bg-web3-neutral/20 text-web3-neutral'
                    }`}>
                      {phase.icon}
                    </div>
                    {phase.status === 'current' && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4 text-web3-primary" />
                        <span className="text-xs text-web3-primary font-medium">In Progress</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {phase.phase}
                    </h3>
                    <p className="text-sm text-web3-primary font-medium">
                      {phase.timeline}
                    </p>
                  </div>
                  
                  <h4 className="text-base font-semibold text-foreground mb-2">
                    {phase.title}
                  </h4>
                  
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {phase.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Growth Strategy */}
        <div>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground tracking-tight">
              Growth Strategy
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto font-medium">
              Sustainable growth through targeted markets, tokenomics, and future-ready expansion plans 
              that align with the Web3 ecosystem evolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {strategies.map((strategy, index) => (
              <Card key={index} className="bg-card border border-border shadow-card hover:shadow-corporate transition-all duration-300 group">
                <CardContent className="p-8">
                  <div className="mb-6">
                    <div className="w-14 h-14 bg-web3-primary/10 rounded-lg flex items-center justify-center text-web3-primary transition-transform duration-300 mb-4">
                      {strategy.icon}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold mb-4 text-foreground">
                    {strategy.title}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {strategy.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-16">
            <div className="bg-web3-primary rounded-lg p-12 text-center max-w-4xl mx-auto">
              <h3 className="text-3xl font-bold text-white mb-6">
                Join the Revolution Early
              </h3>
              <p className="text-white/90 text-xl mb-8 max-w-2xl mx-auto font-medium">
                Be part of the first crypto-native freelance platform. Early adopters receive token rewards 
                and help shape the future of decentralized work.
              </p>
              <button className="bg-white text-web3-primary px-10 py-4 rounded-lg font-bold text-lg hover:bg-gray-50 transition-colors">
                Get Early Access
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Roadmap;