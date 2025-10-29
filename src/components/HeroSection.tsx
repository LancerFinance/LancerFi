import { useState, useEffect } from "react";
import { Shield, Zap, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/supabase";
import { PROJECT_CATEGORIES } from "@/lib/categories";
import { InteractiveImageAccordion } from "@/components/ui/interactive-image-accordion";

const HeroSection = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activeServices, setActiveServices] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadActiveServices = async () => {
      try {
        const projects = await db.getProjects({ status: "active" });
        setActiveServices(projects.length);
      } catch (error) {
        console.error("Error loading active services:", error);
      }
    };

    loadActiveServices();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (selectedCategory && selectedCategory !== "all") params.set("category", selectedCategory);

    navigate(`/browse-services?${params.toString()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <section className="relative py-16 sm:py-20 bg-background overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Main 3D Hero Card */}
          <div className="rounded-3xl bg-gradient-to-br from-card to-secondary/20 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 md:p-12 hover-lift overflow-hidden relative">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full -ml-24 -mb-24"></div>

            <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="space-y-6">
                <div className="inline-block px-4 py-2 bg-background/80 rounded-full text-sm font-medium text-muted-foreground border border-border">
                  Web3 Freelance Platform
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
                  Find the perfect
                  <br />
                  <span className="text-primary">Web3</span> service
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
                  Discover talented freelancers offering blockchain development, DeFi solutions, NFT creation, and more
                  with secure escrow payments
                </p>

                {/* Filter Tags */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setSelectedCategory("blockchain-infra");
                      navigate("/browse-services?category=blockchain-infra");
                    }}
                    className="px-4 py-2 bg-background hover:bg-secondary/80 rounded-full text-sm transition-all duration-200 hover-lift border border-border shadow-sm flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Blockchain Dev
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory("smart-contracts");
                      navigate("/browse-services?category=smart-contracts");
                    }}
                    className="px-4 py-2 bg-background hover:bg-secondary/80 rounded-full text-sm transition-all duration-200 hover-lift border border-border shadow-sm flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Smart Contracts
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory("defi-engineering");
                      navigate("/browse-services?category=defi-engineering");
                    }}
                    className="px-4 py-2 bg-background hover:bg-secondary/80 rounded-full text-sm transition-all duration-200 hover-lift border border-border shadow-sm flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    DeFi
                  </button>
                </div>

                {/* Search bar moved to Header */}

                {/* Popular Searches */}
                <div>
                  <p className="text-sm text-muted-foreground mb-3">Popular:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Smart Contract Audit",
                      "DeFi Protocol",
                      "NFT Collection",
                      "Web3 Frontend",
                      "Solana Development",
                    ].map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setSearchTerm(term);
                          navigate(`/browse-services?search=${encodeURIComponent(term)}`);
                        }}
                        className="px-3 py-1.5 bg-secondary/50 hover:bg-secondary rounded-full text-xs transition-all duration-200"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right - Interactive Image Accordion */}
              <div className="w-full">
                <InteractiveImageAccordion />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
