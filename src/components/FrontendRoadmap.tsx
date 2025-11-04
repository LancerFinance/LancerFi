import { Chrome, Smartphone, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FrontendRoadmap = () => {
  const phases = [
    {
      phase: "Phase 1",
      title: "Chrome Extension (Launch)",
      icon: <Chrome className="w-8 h-8" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      items: [
        "Build and release the official LancerFi Google Chrome Extension",
        "Enable wallet connection and job posting directly from the browser",
        "Integrate trustless escrow and USDC payments on Solana",
        "Launch beta testing for early freelancers and clients",
        "Gather feedback and improve user experience before mainnet release"
      ]
    },
    {
      phase: "Phase 2",
      title: "Mobile App (Expansion)",
      icon: <Smartphone className="w-8 h-8" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      items: [
        "Develop LancerFi Mobile App for iOS & Android",
        "Seamless wallet integration with Solana mobile wallets",
        "Enable push notifications for job updates and payment status",
        "Add real-time chat between clients and freelancers",
        "Launch in-app dispute resolution and escrow tracking",
        "Introduce cross-platform sync (browser and mobile)"
      ]
    }
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 md:mb-16 fade-in">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-foreground tracking-tight">
            Frontend Roadmap
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-3xl mx-auto">
            Our roadmap for expanding LancerFi across all platforms. From browser extensions to mobile apps, 
            we're building the future of Web3 freelancing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-6xl mx-auto">
          {phases.map((phase, index) => (
            <Card 
              key={index}
              className="bg-gradient-card border-border/50 hover:shadow-lg transition-shadow fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 ${phase.bgColor} rounded-xl flex items-center justify-center ${phase.color}`}>
                    {phase.icon}
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      {phase.phase}
                    </div>
                    <CardTitle className="text-xl sm:text-2xl text-foreground">
                      {phase.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {phase.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <CheckCircle className={`w-5 h-5 ${phase.color} flex-shrink-0 mt-0.5`} />
                      <span className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-8 sm:mt-12 md:mt-16 fade-in">
          <a
            href="https://x.com/LancerFi"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm sm:text-base text-muted-foreground hover:text-primary transition-colors cursor-pointer group"
          >
            <span>Stay updated on our progress</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default FrontendRoadmap;

