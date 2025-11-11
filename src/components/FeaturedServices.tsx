import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Clock, DollarSign } from "lucide-react";
import { db } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  budget_usdc: number;
  timeline: string;
  required_skills: string[];
  client_id: string;
  freelancer?: {
    full_name: string;
    username: string;
    rating: number;
    total_earned: number;
    completed_projects: number;
  };
}

const FeaturedServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadFeaturedServices();
  }, []);

  const loadFeaturedServices = async () => {
    try {
      const projects = await db.getProjects();
      
      // Featured service IDs to always show
      const featuredServiceIds = [
        'fbd2f08c-a7b9-46bd-ba97-12e95b293b36', // NFT Platform LandingPage
        '49c35814-853a-481d-8161-71050fc005bb'  // Defi Trading Platform
      ];
      
      // Get the featured services by ID first
      const featuredById = projects.filter(project => 
        featuredServiceIds.includes(project.id)
      );
      
      // Sort featured services to match the order in featuredServiceIds
      const sortedFeatured = featuredServiceIds
        .map(id => featuredById.find(p => p.id === id))
        .filter(Boolean) as Service[];
      
      // Get additional services (top services with freelancers assigned, excluding already featured ones)
      const additionalServices = projects
        .filter(project => 
          project.freelancer_id && 
          project.status !== 'completed' &&
          !featuredServiceIds.includes(project.id)
        )
        .slice(0, 4); // Get up to 4 more to fill out to 6 total
      
      // Combine featured services with additional services
      const allFeaturedServices = [...sortedFeatured, ...additionalServices].slice(0, 6);

      setServices(allFeaturedServices as Service[]);
    } catch (error) {
      console.error('Error loading featured services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceClick = (serviceId: string) => {
    navigate(`/service/${serviceId}`);
  };

  if (loading) {
    return (
      <section className="py-20 bg-gradient-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">Featured Services</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted h-64 rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 bg-background">
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 fade-in">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-4">Featured Services</h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-2">
            Discover top-rated Web3 services from our expert freelancers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.id} 
              className="group relative overflow-hidden rounded-2xl cursor-pointer hover-lift fade-in shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border bg-gradient-to-br from-card to-secondary/20"
              style={{ animationDelay: `${index * 0.1}s` }}
              onClick={() => handleServiceClick(service.id)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <Badge variant="secondary" className="text-xs bg-secondary/80 text-secondary-foreground border border-border">
                    {service.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-medium">{service.freelancer?.rating || 5.0}</span>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold line-clamp-2 group-hover:text-primary transition-colors mb-3">
                  {service.title}
                </h3>

                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {service.description}
                </p>
                
                <div className="flex flex-wrap gap-1 mb-4">
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
                  <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
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

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{service.timeline}</span>
                  </div>
                  <div className="flex items-center gap-1 text-lg font-bold text-foreground">
                    <DollarSign className="h-5 w-5" />
                    <span>{service.budget_usdc}</span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mb-12"></div>
            </div>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-12">
            <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-12 max-w-md mx-auto">
              <p className="text-muted-foreground mb-6">No featured services available at the moment.</p>
              <Button 
                className="ripple"
                onClick={() => navigate('/browse-services')}
              >
                Browse All Services
              </Button>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mb-16"></div>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

export default FeaturedServices;