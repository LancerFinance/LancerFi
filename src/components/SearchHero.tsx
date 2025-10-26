import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { db } from "@/lib/supabase";
import { PROJECT_CATEGORIES } from "@/lib/categories";

const SearchHero = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activeServices, setActiveServices] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const loadActiveServices = async () => {
      try {
        const projects = await db.getProjects({ status: 'in_progress' });
        setActiveServices(projects.length);
      } catch (error) {
        console.error("Error loading active services:", error);
      }
    };

    loadActiveServices();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('search', searchTerm);
    if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
    
    navigate(`/browse-services?${params.toString()}`);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <section className="relative py-12 sm:py-16 bg-background overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 fade-in">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground tracking-tight mb-4">
              Find the perfect <span className="text-primary">Web3</span> service
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Discover talented freelancers offering blockchain development, DeFi solutions, 
              NFT creation, and more with secure escrow payments
            </p>
          </div>

          {/* Search Bar */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-w-4xl mx-auto hover-lift mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder="Search for any service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-12 h-14 text-base border-border bg-background text-foreground focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="md:w-64 h-14 border-border bg-background text-foreground">
                  <SelectValue placeholder="Select category" />
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
                className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold ripple"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>
          </div>

          {/* Popular Searches */}
          <div className="mb-12 fade-in">
            <p className="text-sm text-muted-foreground mb-4 text-center">Popular searches:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Smart Contract Audit', 'DeFi Protocol', 'NFT Collection', 'Web3 Frontend', 'Solana Development'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchTerm(term);
                    navigate(`/browse-services?search=${encodeURIComponent(term)}`);
                  }}
                  className="px-4 py-2 bg-card hover:bg-secondary/80 rounded-full text-sm transition-all duration-200 hover-lift border border-border shadow-sm"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* 3D Card Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 hover-lift fade-in">
              <div className="text-5xl font-bold text-foreground mb-2">{activeServices}</div>
              <div className="text-sm text-muted-foreground font-medium">Active Services</div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 hover-lift fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="text-5xl font-bold text-foreground mb-2">98%</div>
              <div className="text-sm text-muted-foreground font-medium">Client Satisfaction</div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            </div>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 hover-lift fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="text-5xl font-bold text-foreground mb-2">24/7</div>
              <div className="text-sm text-muted-foreground font-medium">Escrow Protection</div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchHero;