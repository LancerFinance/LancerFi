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
import { db } from "@/lib/supabase";

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
      const projects = await db.getProjects();
      
      // Filter active projects and add freelancer info
      const activeServices = projects.filter(project => 
        project.status === 'active' || project.status === 'in_progress'
      );

      setServices(activeServices as Service[]);
    } catch (error) {
      console.error('Error loading services:', error);
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
      
      <div className="container mx-auto px-4 py-8">
        {/* Search and Filters Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="lg:w-64">
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
              <SelectTrigger className="lg:w-48">
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
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {(showFilters || window.innerWidth >= 1024) && (
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="font-semibold mb-4">Price Range</h3>
              <div className="space-y-4">
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={10000}
                  min={0}
                  step={100}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>${priceRange[0]}</span>
                  <span>${priceRange[1]}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Browse Services</h1>
            <p className="text-muted-foreground">
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