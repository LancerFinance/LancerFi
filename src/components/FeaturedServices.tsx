import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      
      // Get featured services (top 6 with freelancers assigned)
      const featuredServices = projects
        .filter(project => project.freelancer_id && project.status !== 'completed')
        .slice(0, 6);

      setServices(featuredServices as Service[]);
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
    <section className="py-20 bg-gradient-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">Featured Services</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover top-rated Web3 services from our expert freelancers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className="group hover:shadow-glow transition-all duration-300 cursor-pointer border-border/50 bg-card/80 backdrop-blur-sm"
              onClick={() => handleServiceClick(service.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {service.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>{service.freelancer?.rating || 5.0}</span>
                  </div>
                </div>
                <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                  {service.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
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
            </Card>
          ))}
        </div>

        {services.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No featured services available at the moment.</p>
            <Button 
              className="mt-4"
              onClick={() => navigate('/browse-services')}
            >
              Browse All Services
            </Button>
          </div>
        )}

        <div className="text-center mt-12">
          <Button 
            size="lg" 
            onClick={() => navigate('/browse-services')}
            className="bg-primary hover:bg-primary/90"
          >
            View All Services
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedServices;