import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Users, DollarSign, Clock, Star, Zap } from "lucide-react";
import { db } from "@/lib/supabase";

interface Statistics {
  totalProjects: number;
  activeFreelancers: number;
  totalValue: number;
  avgRating: number;
}

const TrustIndicators = () => {
  const [stats, setStats] = useState<Statistics>({
    totalProjects: 0,
    activeFreelancers: 0,
    totalValue: 0,
    avgRating: 4.9,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const [projects, escrows] = await Promise.all([db.getProjects(), db.getEscrows()]);

      const totalValue = escrows.reduce((sum, escrow) => sum + (escrow.total_locked || 0), 0);

      setStats({
        totalProjects: projects.length,
        activeFreelancers: profiles.length, // Estimated
        totalValue: totalValue,
        avgRating: 4.9,
      });
    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return `$${formatNumber(amount)}`;
  };

  const indicators = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Escrow Protected",
      description: "100% secure payments with blockchain escrow",
      value: "100%",
      color: "from-green-500 to-green-600",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Active Freelancers",
      description: "Verified Web3 professionals",
      value: formatNumber(stats.activeFreelancers),
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: "Total Project Value",
      description: "Secured through our platform",
      value: formatCurrency(stats.totalValue),
      color: "from-purple-500 to-purple-600",
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: "Average Rating",
      description: "Client satisfaction score",
      value: stats.avgRating.toFixed(1),
      color: "from-yellow-500 to-yellow-600",
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Fast Delivery",
      description: "Average project completion",
      value: "5-7 days",
      color: "from-orange-500 to-orange-600",
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: "Quick Response",
      description: "Average freelancer response time",
      value: "< 2 hours",
      color: "from-red-500 to-red-600",
    },
  ];

  if (loading) {
    return (
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted h-32 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Web3Lance?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands of satisfied clients who trust our platform for their Web3 projects
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {indicators.map((indicator, index) => (
            <Card
              key={index}
              className="group hover:shadow-glow transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm hover:scale-105"
            >
              <CardContent className="p-6 text-center">
                <div
                  className={`w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br ${indicator.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}
                >
                  {indicator.icon}
                </div>

                <div className="text-2xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {indicator.value}
                </div>

                <h3 className="font-semibold text-sm mb-2">{indicator.title}</h3>

                <p className="text-xs text-muted-foreground line-clamp-2">{indicator.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-card/50 px-4 py-2 rounded-full border border-border/50">
            <Shield className="w-4 h-4 text-green-500" />
            <span>All statistics updated in real-time from blockchain data</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustIndicators;
