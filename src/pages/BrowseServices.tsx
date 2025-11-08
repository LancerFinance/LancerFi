import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import Header from "@/components/Header";
import { Search, Filter, Star, Clock, DollarSign, Grid, List } from "lucide-react";
import { db, supabase } from "@/lib/supabase";

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  budget_usdc: number;
  timeline: string;
  required_skills: string[];
  status: string;
  created_at?: string;
  project_images?: string[];
  freelancer?: {
    id: string;
    full_name: string;
    username: string;
    rating: number;
    total_earned: number;
    completed_projects: number;
  };
}

const categories = [
  "Web Development",
  "Smart Contracts", 
  "DeFi Development",
  "NFT Development",
  "Blockchain Development",
  "UI/UX Design",
  "Mobile Development",
  "Marketing",
  "Content Writing",
  "Data Analysis"
];

const BrowseServices = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    setSearchTerm(searchParams.get('search') || '');
    setSelectedCategory(searchParams.get('category') || 'all');
  }, [searchParams]);

  const loadServices = async () => {
    try {
      setLoading(true);
      // Only get projects that have successfully funded escrows
      // This ensures we only show projects where payment was actually completed
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          *,
          escrows!inner(
            id,
            status
          )
        `)
        .eq('status', 'active')
        .eq('escrows.status', 'funded')
        .is('freelancer_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        // If join fails, fallback to checking escrows separately
        const allProjects = await db.getProjects({ status: 'active' });
        const projectsWithEscrows = await Promise.all(
          allProjects.map(async (project) => {
            if (project.freelancer_id) return null; // Skip projects with freelancers
            const escrow = await db.getEscrow(project.id);
            return escrow && escrow.status === 'funded' ? project : null;
          })
        );
        const validProjects = projectsWithEscrows.filter(p => p !== null);
        setServices(validProjects as Service[]);
      } else {
        setServices((projects || []) as Service[]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      // Fallback: try to get projects and filter by escrow status
      try {
        const allProjects = await db.getProjects({ status: 'active' });
        const projectsWithEscrows = await Promise.all(
          allProjects.map(async (project) => {
            if (project.freelancer_id) return null;
            const escrow = await db.getEscrow(project.id);
            return escrow && escrow.status === 'funded' ? project : null;
          })
        );
        const validProjects = projectsWithEscrows.filter(p => p !== null);
        setServices(validProjects as Service[]);
      } catch (fallbackError) {
        console.error('Fallback error loading services:', fallbackError);
        setServices([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = !searchTerm || 
      service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.required_skills?.some(skill => 
        skill.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    const matchesPrice = service.budget_usdc >= priceRange[0] && service.budget_usdc <= priceRange[1];
    
    return matchesSearch && matchesCategory && matchesPrice;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'price-low':
        return a.budget_usdc - b.budget_usdc;
      case 'price-high':
        return b.budget_usdc - a.budget_usdc;
      case 'rating':
        return (b.freelancer?.rating || 0) - (a.freelancer?.rating || 0);
      default:
        return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
    }
  });

  const handleServiceClick = (serviceId: string) => {
    navigate(`/service/${serviceId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted h-64 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        {/* Search and Filters Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-10 h-10 sm:h-12 text-xs sm:text-sm md:text-base"
              />
            </div>
            
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {/* Category Filter */}
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 h-10 sm:h-12 text-xs sm:text-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-48 h-10 sm:h-12 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className="h-10 w-10 sm:h-12 sm:w-12"
                >
                  <Grid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className="h-10 w-10 sm:h-12 sm:w-12"
                >
                  <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {(showFilters || window.innerWidth >= 1024) && (
            <div className="bg-card rounded-lg p-4 sm:p-6 border">
              <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Price Range</h3>
              <div className="space-y-3 sm:space-y-4">
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={10000}
                  min={0}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                  <span>${priceRange[0]}</span>
                  <span>${priceRange[1]}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Browse Services</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {filteredServices.length} services found
              {searchTerm && ` for "${searchTerm}"`}
              {selectedCategory && selectedCategory !== 'all' && ` in ${selectedCategory}`}
            </p>
          </div>
        </div>

        {/* Services Grid/List */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No services found matching your criteria.</p>
            <Button onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setPriceRange([0, 10000]);
            }}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
            : "space-y-4"
          }>
            {filteredServices.map((service) => (
              <Card 
                key={service.id} 
                className={`group hover:shadow-glow transition-all duration-300 cursor-pointer border-border/50 bg-card/80 backdrop-blur-sm ${
                  viewMode === 'list' ? 'flex flex-row' : ''
                }`}
                onClick={() => handleServiceClick(service.id)}
              >
                {service.project_images && service.project_images.length > 0 && (
                  <div className={viewMode === 'list' ? 'w-48 flex-shrink-0' : 'w-full'}>
                    <img 
                      src={service.project_images[0]} 
                      alt={service.title}
                      className={`object-cover ${
                        viewMode === 'list' ? 'h-full w-full' : 'h-48 w-full rounded-t-lg'
                      }`}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <CardHeader className={viewMode === 'list' ? 'flex-1 pb-3' : 'pb-3'}>
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {service.category}
                      </Badge>
                      {service.freelancer?.rating && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span>{service.freelancer.rating}</span>
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                      {service.title}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className={`space-y-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {service.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-1">
                    {service.required_skills?.slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {service.required_skills?.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{service.required_skills.length - 3}
                      </Badge>
                    )}
                  </div>

                  {service.freelancer && (
                    <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {service.freelancer.full_name?.charAt(0) || 'F'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{service.freelancer.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {service.freelancer.completed_projects} projects completed
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{service.timeline}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-lg font-bold text-primary">
                      <DollarSign className="h-5 w-5" />
                      <span>{service.budget_usdc}</span>
                    </div>
                  </div>

                    <Button 
                      className="w-full mt-4" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleServiceClick(service.id);
                      }}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowseServices;