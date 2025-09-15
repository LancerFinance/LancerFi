import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Star, MapPin, Clock, Globe, DollarSign, Award, BookOpen, Languages, ExternalLink, MessageCircle, Briefcase } from "lucide-react";
import { supabase, Profile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const FreelancerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      loadProfile(id);
    }
  }, [id]);

  const loadProfile = async (profileId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error",
        description: "Failed to load freelancer profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-web3-success';
      case 'busy': return 'text-web3-warning';
      default: return 'text-muted-foreground';
    }
  };

  const getAvailabilityText = (status: string) => {
    switch (status) {
      case 'available': return 'Available for new projects';
      case 'busy': return 'Currently busy';
      default: return 'Status unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Profile Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The requested freelancer profile could not be found.
              </p>
              <Link to="/hire-talent">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Talent
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <Link to="/hire-talent">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Talent
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row gap-8">
                {/* Profile Image & Basic Info */}
                <div className="flex-shrink-0">
                  <Avatar className="w-32 h-32 mx-auto lg:mx-0">
                    <AvatarImage src="/placeholder.svg" alt={profile.full_name || 'Freelancer'} />
                    <AvatarFallback className="bg-web3-primary text-white text-2xl">
                      {profile.full_name?.split(' ').map(n => n[0]).join('') || 'FL'}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Profile Details */}
                <div className="flex-1 text-center lg:text-left">
                  <div className="mb-4">
                    <h1 className="text-3xl font-bold mb-2">{profile.full_name}</h1>
                    <p className="text-lg text-muted-foreground mb-2">@{profile.username}</p>
                    <div className="flex items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
                      {profile.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {profile.location}
                        </div>
                      )}
                      {profile.response_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Responds {profile.response_time}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Availability Status */}
                  <div className={`inline-flex items-center gap-2 mb-4 ${getAvailabilityColor(profile.availability_status || 'available')}`}>
                    <div className="w-2 h-2 rounded-full bg-current"></div>
                    <span className="font-medium">{getAvailabilityText(profile.availability_status || 'available')}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex justify-center lg:justify-start gap-6 mb-6">
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-web3-warning text-web3-warning" />
                        <span className="font-bold">{profile.rating || 0}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Rating</span>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">{profile.completed_projects || 0}</div>
                      <span className="text-xs text-muted-foreground">Projects</span>
                    </div>
                    <div className="text-center">
                      <div className="font-bold">${profile.hourly_rate || 0}/hr</div>
                      <span className="text-xs text-muted-foreground">Rate</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                    <Link to="/post-project">
                      <Button size="lg" className="w-full sm:w-auto">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Hire {profile.full_name?.split(' ')[0]}
                      </Button>
                    </Link>
                    <Button variant="outline" size="lg" className="w-full sm:w-auto">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Send Message
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* About */}
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {profile.bio || 'No bio available.'}
                  </p>
                </CardContent>
              </Card>

              {/* Skills */}
              <Card>
                <CardHeader>
                  <CardTitle>Skills & Expertise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills?.map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    )) || <p className="text-muted-foreground">No skills listed.</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Portfolio */}
              {profile.portfolio_url && (
                <Card>
                  <CardHeader>
                    <CardTitle>Portfolio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a 
                      href={profile.portfolio_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-web3-primary hover:underline"
                    >
                      <Globe className="w-4 h-4" />
                      View Portfolio
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Experience */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5" />
                    Experience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Years of Experience</span>
                    <span className="font-medium">{profile.experience_years || 0} years</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Earned</span>
                    <span className="font-medium">${profile.total_earned?.toLocaleString() || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className="font-medium">95%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Languages */}
              {profile.languages && profile.languages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="w-5 h-5" />
                      Languages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.languages.map((language, index) => (
                        <div key={index} className="text-sm">
                          {language}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Education */}
              {profile.education && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{profile.education}</p>
                  </CardContent>
                </Card>
              )}

              {/* Certifications */}
              {profile.certifications && profile.certifications.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Certifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.certifications.map((cert, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {cert}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FreelancerProfile;