import { Rocket, Settings, Users, Shield, Smartphone, CheckCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FrontendRoadmap = () => {
  const phases = [
    {
      phase: "Phase 0",
      title: "Platform Launch",
      icon: <Rocket className="w-8 h-8" />,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      items: [
        "Frontend and backend implementation of LancerFi",
        "X402 payment integration",
        "Pump.fun token launch"
      ]
    },
    {
      phase: "Phase 1",
      title: "Frontend Accessibility",
      icon: <Settings className="w-8 h-8" />,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      items: [
        "Increased escrow budget for already existing projects",
        "Higher file limit sizes for work submissions",
        "Enhanced messaging system with improved features"
      ]
    },
    {
      phase: "Phase 2",
      title: "Team Formation",
      icon: <Users className="w-8 h-8" />,
      color: "text-green-600",
      bgColor: "bg-green-50",
      items: [
        "Forming teams for project development",
        "Payment splitting among team members",
        "Multi-currency support for payments"
      ]
    },
    {
      phase: "Phase 3",
      title: "Governance & Tokenomics",
      icon: <Shield className="w-8 h-8" />,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      items: [
        "Governance rights for token holders",
        "DAO voting system for platform decisions",
        "Lower fees for token holders",
        "Holder exclusive perks and benefits"
      ]
    },
    {
      phase: "Phase 4",
      title: "Mobile Application",
      icon: <Smartphone className="w-8 h-8" />,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      items: [
        "Develop LancerFi Mobile App for iOS & Android",
        "Introduce cross-platform sync (browser and mobile)",
        "Experimental features"
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
            Our comprehensive roadmap for building and expanding LancerFi. From platform launch to mobile expansion, 
            we're building the future of Web3 freelancing step by step.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          {/* First row: Phase 0, 1, 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
            {phases.slice(0, 3).map((phase, index) => (
              <Card 
                key={index}
                className="bg-gradient-card border-border/50 hover:shadow-lg transition-all duration-200 hover:scale-110 fade-in"
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

          {/* Second row: Phase 3, 4 (centered) */}
          <div className="flex justify-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl">
              {phases.slice(3).map((phase, index) => (
                <Card 
                  key={index + 3}
                  className="bg-gradient-card border-border/50 hover:shadow-lg transition-all duration-200 hover:scale-110 fade-in"
                  style={{ animationDelay: `${(index + 3) * 0.1}s` }}
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
          </div>
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

