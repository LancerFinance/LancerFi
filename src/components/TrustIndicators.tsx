import { useEffect, useState } from "react";
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
      const [projects, escrows, profiles] = await Promise.all([
        db.getProjects({ status: 'in_progress' }), 
        db.getEscrows(), 
        db.getProfiles()
      ]);

      const totalValue = escrows.reduce((sum, escrow) => sum + (escrow.total_locked || 0), 0);

      setStats({
        totalProjects: projects.length,
        activeFreelancers: profiles.length,
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
    <section className="py-16 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {indicators.slice(0, 4).map((indicator, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/20 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-6 text-center hover-lift fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
                {indicator.icon}
              </div>
              <div className="text-3xl font-bold text-foreground mb-1">{indicator.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{indicator.title}</div>
              <div className="absolute bottom-0 right-0 w-20 h-20 bg-primary/5 rounded-full -mr-10 -mb-10"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustIndicators;
