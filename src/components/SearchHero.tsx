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
    <section className="py-24 bg-gradient-hero text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-transparent"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="h-8 w-8 text-yellow-400" />
          <h1 className="text-5xl md:text-6xl font-bold">
            Find the perfect <span className="text-yellow-400">Web3</span> service
          </h1>
          </div>
          
          <p className="text-xl md:text-2xl mb-12 text-gray-200 max-w-3xl mx-auto">
            Discover talented freelancers offering blockchain development, DeFi solutions, 
            NFT creation, and more with secure escrow payments
          </p>

          {/* Search Bar */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search for any service..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-12 h-14 text-lg border-0 focus:ring-2 focus:ring-primary bg-transparent text-gray-800"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="md:w-64 h-14 border-0 bg-transparent text-gray-800">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
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
                className="h-14 px-8 bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>
          </div>

          {/* Popular Searches */}
          <div className="mt-8">
            <p className="text-sm text-gray-300 mb-4">Popular searches:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Smart Contract Audit', 'DeFi Protocol', 'NFT Collection', 'Web3 Frontend', 'Solana Development'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchTerm(term);
                    navigate(`/browse-services?search=${encodeURIComponent(term)}`);
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm transition-colors backdrop-blur-sm border border-white/20"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 text-center">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-yellow-400">{activeServices}</div>
              <div className="text-sm text-gray-300">Active Services</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-yellow-400">98%</div>
              <div className="text-sm text-gray-300">Client Satisfaction</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-yellow-400">24/7</div>
              <div className="text-sm text-gray-300">Escrow Protection</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SearchHero;