import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/supabase";

const ExploreFreelancers = () => {
  const [freelancers, setFreelancers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFreelancers();
  }, []);

  const fetchFreelancers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .not('bio', 'is', null)
        .not('skills', 'is', null)
        .order('rating', { ascending: false })
        .limit(8);

      if (error) throw error;
      setFreelancers(data || []);
    } catch (error) {
      console.error('Error fetching freelancers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Explore Top Freelancers
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Discover talented Web3 professionals ready to bring your projects to life
            </p>
          </div>
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </section>
    );
  }

  if (freelancers.length === 0) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No freelancers available at the moment.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
      <section className="py-12 sm:py-16 md:py-20 bg-background">
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-12 md:mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2 sm:mb-4">
            Explore Top Freelancers
          </h2>
          <p className="text-sm sm:text-base md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            Discover talented Web3 professionals ready to bring your projects to life
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          {/* Desktop Grid Layout */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">
            {freelancers.slice(0, 4).map((freelancer, index) => (
              <Card key={freelancer.id} className="bg-card border-border shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  {/* Profile Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar className="w-16 h-16 border-2 border-background shadow-md flex-shrink-0">
                      <AvatarImage 
                        src={freelancer.profile_photo_url || ''} 
                        alt={freelancer.full_name || freelancer.username || 'Freelancer'}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                        {(freelancer.full_name || freelancer.username || 'F')
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-foreground mb-1 truncate">
                        {freelancer.full_name || freelancer.username || 'Anonymous'}
                      </h3>
                      
                      {/* Rating Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                          Top Rated
                        </Badge>
                        <div className="flex items-center">
                          {[...Array(4)].map((_, i) => (
                            <Star
                              key={i}
                              className="w-4 h-4 text-yellow-400 fill-current"
                            />
                          ))}
                          <Star className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                      
                      {/* Languages */}
                      <p className="text-sm text-muted-foreground">
                        {freelancer.languages?.join(', ') || 'English'}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2">
                    {freelancer.bio || 'Experienced Web3 developer with a passion for blockchain technology and decentralized applications.'}
                  </p>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(freelancer.skills || []).slice(0, 4).map((skill, skillIndex) => (
                      <Badge
                        key={skillIndex}
                        variant="outline"
                        className="text-xs bg-muted/50 hover:bg-muted transition-colors"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {(freelancer.skills || []).length > 4 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{(freelancer.skills || []).length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Bottom Section */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        {freelancer.completed_projects || 0} Reviews
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm font-bold text-foreground">
                          {freelancer.rating?.toFixed(1) || '0.0'}
                        </span>
                      </div>
                    </div>
                    
                    <Button asChild size="sm" className="bg-foreground text-background hover:bg-foreground/90">
                      <Link to={`/freelancer/${freelancer.id}`}>
                        See profile
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mobile Stacked Layout */}
          <div className="md:hidden space-y-3 sm:space-y-4">
            {freelancers.map((freelancer, index) => (
              <Card key={freelancer.id} className="bg-card border-border shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-4 sm:p-5 md:p-6">
                  {/* Profile Header */}
                  <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <Avatar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-2 border-background shadow-md flex-shrink-0">
                      <AvatarImage 
                        src={freelancer.profile_photo_url || ''} 
                        alt={freelancer.full_name || freelancer.username || 'Freelancer'}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-base md:text-lg font-bold">
                        {(freelancer.full_name || freelancer.username || 'F')
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground mb-1 truncate">
                        {freelancer.full_name || freelancer.username || 'Anonymous'}
                      </h3>
                      
                      {/* Rating Badge */}
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1">
                          Top Rated
                        </Badge>
                        <div className="flex items-center">
                          {[...Array(4)].map((_, i) => (
                            <Star
                              key={i}
                              className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-yellow-400 fill-current"
                            />
                          ))}
                          <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-gray-300" />
                        </div>
                      </div>
                      
                      {/* Languages */}
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {freelancer.languages?.join(', ') || 'English'}
                      </p>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 line-clamp-2">
                    {freelancer.bio || 'Experienced Web3 developer with a passion for blockchain technology and decentralized applications.'}
                  </p>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    {(freelancer.skills || []).slice(0, 4).map((skill, skillIndex) => (
                      <Badge
                        key={skillIndex}
                        variant="outline"
                        className="text-[10px] sm:text-xs bg-muted/50 hover:bg-muted transition-colors"
                      >
                        {skill}
                      </Badge>
                    ))}
                    {(freelancer.skills || []).length > 4 && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs text-muted-foreground">
                        +{(freelancer.skills || []).length - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Bottom Section */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="text-xs sm:text-sm text-muted-foreground">
                        {freelancer.completed_projects || 0} Reviews
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 fill-current" />
                        <span className="text-xs sm:text-sm font-bold text-foreground">
                          {freelancer.rating?.toFixed(1) || '0.0'}
                        </span>
                      </div>
                    </div>
                    
                    <Button asChild size="sm" className="bg-foreground text-background hover:bg-foreground/90 text-xs sm:text-sm w-full sm:w-auto">
                      <Link to={`/freelancer/${freelancer.id}`}>
                        See profile
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExploreFreelancers;