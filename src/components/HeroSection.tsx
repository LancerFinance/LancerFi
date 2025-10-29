import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Shield, Zap, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/supabase";
import { PROJECT_CATEGORIES } from "@/lib/categories";
import smartContractsImg from "@/assets/services/smart-contracts.jpg";
import defiImg from "@/assets/services/defi.jpg";
import nftImg from "@/assets/services/nft.jpg";
import dappImg from "@/assets/services/dapp.jpg";

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
                      setSelectedCategory("blockchain");
                      navigate("/browse-services?category=blockchain");
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
                      setSelectedCategory("defi");
                      navigate("/browse-services?category=defi");
                    }}
                    className="px-4 py-2 bg-background hover:bg-secondary/80 rounded-full text-sm transition-all duration-200 hover-lift border border-border shadow-sm flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    DeFi
                  </button>
                </div>

                {/* Search Bar */}
                <div className="bg-background rounded-2xl p-4 shadow-[0_4px_20px_rgb(0,0,0,0.08)] border border-border">
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                      <Input
                        placeholder="Search for any service..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10 h-12 text-base border-border bg-background"
                      />
                    </div>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="md:w-48 h-12 border-border bg-background">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="all">All Categories</SelectItem>
                        {PROJECT_CATEGORIES.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={handleSearch}
                      size="lg"
                      className="h-12 px-8 bg-foreground hover:bg-foreground/90 text-background font-semibold ripple"
                    >
                      <Search className="h-5 w-5 mr-2" />
                      Search
                    </Button>
                  </div>
                </div>

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

              {/* Right - Service Photos Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                  <div className="aspect-square relative">
                    <img
                      src={smartContractsImg}
                      alt="Smart Contracts"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-sm">Smart Contracts</h3>
                    </div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                  <div className="aspect-square relative">
                    <img
                      src={defiImg}
                      alt="DeFi Solutions"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-sm">DeFi Solutions</h3>
                    </div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                  <div className="aspect-square relative">
                    <img
                      src={nftImg}
                      alt="NFT Development"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-sm">NFT Development</h3>
                    </div>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                  <div className="aspect-square relative">
                    <img
                      src={dappImg}
                      alt="DApp Development"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-white font-bold text-sm">DApp Development</h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
