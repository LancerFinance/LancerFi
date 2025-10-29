import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Star, MapPin, Clock, ExternalLink, Users, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/supabase";

const ExploreFreelancers = () => {
  const [freelancers, setFreelancers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    fetchFreelancers();
  }, []);

  // Auto-play slider
  useEffect(() => {
    if (!isAutoPlaying || freelancers.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % freelancers.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, freelancers.length]);

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

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % freelancers.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + freelancers.length) % freelancers.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  if (loading) {
    return (
      <section className="py-16 bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Explore Top Freelancers
            </h2>
            <p className="text-xl text-muted-foreground">
              Discover talented Web3 developers and specialists
            </p>
          </div>
          <div className="flex justify-center">
            <div className="animate-pulse bg-muted/50 rounded-2xl h-96 w-full max-w-4xl"></div>
          </div>
        </div>
      </section>
    );
  }

  if (freelancers.length === 0) {
    return null;
  }

  const currentFreelancer = freelancers[currentIndex];

  return (
    <section className="py-16 bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Explore Top Freelancers
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover talented Web3 developers and specialists ready to bring your ideas to life
          </p>
        </div>

        {/* Main Slider */}
        <div className="relative max-w-6xl mx-auto">
          {/* Navigation Arrows - Hidden on mobile, visible on tablet+ */}
          <button
            onClick={prevSlide}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-background/90 backdrop-blur-sm border border-border rounded-full items-center justify-center hover:bg-background transition-all duration-200 shadow-lg"
            aria-label="Previous freelancer"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>

          <button
            onClick={nextSlide}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-background/90 backdrop-blur-sm border border-border rounded-full items-center justify-center hover:bg-background transition-all duration-200 shadow-lg"
            aria-label="Next freelancer"
          >
            <ChevronRight className="w-6 h-6 text-foreground" />
          </button>

          {/* Freelancer Card */}
          <div className="relative overflow-hidden rounded-3xl mx-16 sm:mx-20 transform hover:scale-[1.02] transition-all duration-500">
            <Card className="bg-gradient-card border-border/50 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
              <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-[500px]">
                  {/* Left Side - Profile Info */}
                  <div className="p-8 lg:p-12 flex flex-col justify-center space-y-6">
                    {/* Profile Header */}
                    <div className="flex items-start gap-4">
                      <Avatar className="w-20 h-20 border-4 border-background shadow-lg flex-shrink-0">
                        <AvatarImage 
                          src={currentFreelancer.profile_photo_url || ''} 
                          alt={currentFreelancer.full_name || currentFreelancer.username || 'Freelancer'}
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                          {(currentFreelancer.full_name || currentFreelancer.username || 'F')
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-bold text-foreground mb-1 truncate">
                          {currentFreelancer.full_name || currentFreelancer.username || 'Anonymous'}
                        </h3>
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          {currentFreelancer.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm truncate">{currentFreelancer.location}</span>
                            </div>
                          )}
                          {currentFreelancer.experience_years && (
                            <div className="flex items-center gap-1">
                              <Award className="w-4 h-4 flex-shrink-0" />
                              <span className="text-sm">{currentFreelancer.experience_years}+ years</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Rating */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < Math.floor(currentFreelancer.rating || 0)
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {currentFreelancer.rating?.toFixed(1) || '0.0'}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({currentFreelancer.completed_projects || 0} projects)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    <p className="text-muted-foreground leading-relaxed line-clamp-3">
                      {currentFreelancer.bio || 'Experienced Web3 developer with a passion for blockchain technology and decentralized applications.'}
                    </p>

                    {/* Skills */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {(currentFreelancer.skills || []).slice(0, 6).map((skill, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {(currentFreelancer.skills || []).length > 6 && (
                          <Badge variant="outline" className="text-muted-foreground">
                            +{(currentFreelancer.skills || []).length - 6} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-foreground">
                          {currentFreelancer.completed_projects || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Projects</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-foreground">
                          {currentFreelancer.response_time || '< 24h'}
                        </div>
                        <div className="text-sm text-muted-foreground">Response</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button asChild className="flex-1">
                        <Link to={`/freelancer/${currentFreelancer.id}`}>
                          <Users className="w-4 h-4 mr-2" />
                          View Profile
                        </Link>
                      </Button>
                      {currentFreelancer.portfolio_url && (
                        <Button variant="outline" asChild>
                          <a
                            href={currentFreelancer.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Portfolio
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Right Side - Visual/Stats */}
                  <div className="relative bg-gradient-to-br from-primary/10 via-primary/20 to-primary/10 p-8 lg:p-12 flex items-center justify-center overflow-hidden">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5"></div>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.1)_0%,transparent_70%)]"></div>
                    
                    {/* 3D Lift Container */}
                    <div className="relative z-10 text-center space-y-6 transform hover:scale-105 transition-all duration-300">
                      {/* Hourly Rate with 3D Effect */}
                      <div className="space-y-2 relative">
                        <div className="text-4xl font-bold text-foreground drop-shadow-lg transform hover:scale-110 transition-transform duration-300">
                          ${currentFreelancer.hourly_rate || 0}/hr
                        </div>
                        <div className="text-muted-foreground font-medium">Hourly Rate</div>
                        {/* 3D Shadow Effect */}
                        <div className="absolute inset-0 text-4xl font-bold text-primary/20 blur-sm -z-10 transform translate-x-1 translate-y-1">
                          ${currentFreelancer.hourly_rate || 0}/hr
                        </div>
                      </div>

                      {/* Availability Status with Enhanced Styling */}
                      <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-600 border border-green-500/30 shadow-lg backdrop-blur-sm transform hover:scale-105 transition-all duration-300">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                        <span className="text-sm font-semibold">
                          {currentFreelancer.availability_status === 'available' ? 'Available' : 'Busy'}
                        </span>
                      </div>

                      {/* Total Earned with 3D Effect */}
                      {currentFreelancer.total_earned && currentFreelancer.total_earned > 0 && (
                        <div className="space-y-1 relative">
                          <div className="text-2xl font-bold text-foreground drop-shadow-lg transform hover:scale-110 transition-transform duration-300">
                            ${currentFreelancer.total_earned.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">Total Earned</div>
                          {/* 3D Shadow Effect */}
                          <div className="absolute inset-0 text-2xl font-bold text-primary/20 blur-sm -z-10 transform translate-x-1 translate-y-1">
                            ${currentFreelancer.total_earned.toLocaleString()}
                          </div>
                        </div>
                      )}

                      {/* Languages with Enhanced Styling */}
                      {currentFreelancer.languages && currentFreelancer.languages.length > 0 && (
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-foreground">Languages</div>
                          <div className="flex flex-wrap justify-center gap-2">
                            {currentFreelancer.languages.slice(0, 3).map((lang, index) => (
                              <Badge 
                                key={index} 
                                variant="outline" 
                                className="text-xs bg-background/50 backdrop-blur-sm border-primary/30 hover:bg-primary/10 hover:scale-105 transition-all duration-300 shadow-md"
                              >
                                {lang}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Decorative Elements */}
                      <div className="absolute top-4 right-4 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>
                      <div className="absolute bottom-4 left-4 w-12 h-12 bg-primary/5 rounded-full blur-lg"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center mt-8 space-x-2">
            {freelancers.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-primary scale-125'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Mobile Navigation - Only visible on mobile */}
        <div className="flex sm:hidden justify-center mt-6 space-x-4">
          <button
            onClick={prevSlide}
            className="w-10 h-10 bg-background/80 backdrop-blur-sm border border-border rounded-full flex items-center justify-center hover:bg-background transition-all duration-200 shadow-lg"
            aria-label="Previous freelancer"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={nextSlide}
            className="w-10 h-10 bg-background/80 backdrop-blur-sm border border-border rounded-full flex items-center justify-center hover:bg-background transition-all duration-200 shadow-lg"
            aria-label="Next freelancer"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* View All Button */}
        <div className="text-center mt-12">
          <Button asChild variant="outline" size="lg">
            <Link to="/hire-talent">
              <Users className="w-5 h-5 mr-2" />
              View All Freelancers
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ExploreFreelancers;
