import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  MapPin, 
  Star, 
  DollarSign, 
  Clock, 
  Briefcase,
  CheckCircle,
  Languages,
  Award,
  GraduationCap,
  Image as ImageIcon
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import MessageDialog from "@/components/MessageDialog";

interface Profile {
  id: string;
  wallet_address?: string;
  username?: string;
  full_name?: string;
  bio?: string;
  skills?: string[];
  hourly_rate?: number;
  total_earned?: number;
  rating?: number;
  completed_projects?: number;
  portfolio_url?: string;
  experience_years?: number;
  availability_status?: string;
  languages?: string[];
  education?: string;
  certifications?: string[];
  response_time?: string;
  location?: string;
  timezone?: string;
  banner_url?: string;
  profile_photo_url?: string;
}

// Past Works Component
const PastWorksSection = ({ freelancerId }: { freelancerId: string }) => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPastWorks();
  }, [freelancerId]);

  const loadPastWorks = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('freelancer_id', freelancerId)
        .eq('status', 'completed')
        .not('project_images', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading past works:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-web3-primary" />
            Past Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading past works...</p>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-web3-primary" />
          Past Works ({projects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="space-y-2">
              <Link to={`/project/${project.id}`}>
                <h4 className="font-semibold hover:text-web3-primary transition-colors">
                  {project.title}
                </h4>
              </Link>
              {project.project_images && project.project_images.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {project.project_images.slice(0, 4).map((img: string, idx: number) => (
                    <img 
                      key={idx}
                      src={img} 
                      alt={`${project.title} - ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-md hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const FreelancerProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
      
      // Calculate total earned
      let totalEarned: number | null = null;
      if (data?.id) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('freelancer_id', data.id);
        
        const projectIds = (projects || []).map((p: any) => p.id);

        if (projectIds.length > 0) {
          const { data: escrows } = await supabase
            .from('escrows')
            .select('amount_usdc')
            .in('project_id', projectIds)
            .eq('status', 'released');
            
          if (escrows && escrows.length > 0) {
            totalEarned = escrows.reduce((sum: number, e: any) => sum + Number(e.amount_usdc || 0), 0);
          }
        }
      }
      
      if (totalEarned !== null) {
        data.total_earned = totalEarned;
      }
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
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
      
      {/* Banner Image */}
      {profile.banner_url && (
        <div className="w-full h-64 overflow-hidden">
          <img 
            src={profile.banner_url} 
            alt="Profile banner" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <main className="container mx-auto px-4 py-8">
        <Link to="/hire-talent" className="inline-flex mb-6">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Browse Talent
          </Button>
        </Link>

        <div className="max-w-6xl mx-auto">
          {/* Profile Photo and Header */}
          <div className="flex items-start gap-6 mb-8 -mt-20 relative z-10">
            <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
              <AvatarImage src={profile.profile_photo_url || ''} />
              <AvatarFallback className="text-3xl">
                {profile.full_name?.split(' ').map(n => n[0]).join('') || profile.username?.[0]?.toUpperCase() || 'FL'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 mt-16">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {profile.full_name || profile.username}
                  </h1>
                  <div className="flex items-center gap-4 text-muted-foreground mb-4">
                    {profile.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {profile.location}
                      </div>
                    )}
                    {profile.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-web3-warning text-web3-warning" />
                        {profile.rating.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/post-project?freelancer=${profile.id}`}>
                    <Button size="lg" className="bg-web3-primary hover:bg-web3-primary/90">
                      <Briefcase className="w-4 h-4 mr-2" />
                      Hire
                    </Button>
                  </Link>
                  <MessageDialog
                    recipientId={profile.wallet_address || ''}
                    recipientName={profile.full_name || profile.username || 'Freelancer'}
                    projectTitle=""
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
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
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    )) || <p className="text-muted-foreground">No skills listed.</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Education */}
              {profile.education && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-web3-primary" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {profile.education}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Past Works */}
              <PastWorksSection freelancerId={profile.id} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Stats Card */}
              <Card className="bg-gradient-card border-web3-primary/30">
                <CardContent className="p-6 space-y-4">
                  <div className={`inline-flex items-center gap-2 ${getAvailabilityColor(profile.availability_status || 'available')}`}>
                    <div className="w-2 h-2 rounded-full bg-current"></div>
                    <span className="font-medium">{getAvailabilityText(profile.availability_status || 'available')}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-web3-warning text-web3-warning" />
                        <span className="font-bold">{profile.rating || 0}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Rating</span>
                    </div>
                    <div>
                      <div className="font-bold">{profile.completed_projects || 0}</div>
                      <span className="text-xs text-muted-foreground">Projects</span>
                    </div>
                    <div>
                      <div className="font-bold">${profile.hourly_rate || 0}/hr</div>
                      <span className="text-xs text-muted-foreground">Rate</span>
                    </div>
                    <div>
                      <div className="font-bold">${profile.total_earned?.toLocaleString() || 0}</div>
                      <span className="text-xs text-muted-foreground">Earned</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Experience */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-web3-primary" />
                    Experience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Years</span>
                      <span className="font-medium">{profile.experience_years || 0}</span>
                    </div>
                    {profile.response_time && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Response</span>
                        <span className="font-medium">{profile.response_time}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Languages */}
              {profile.languages && profile.languages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="w-5 h-5 text-web3-primary" />
                      Languages
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {profile.languages.map((language, index) => (
                        <Badge key={index} variant="outline">
                          {language}
                        </Badge>
                      ))}
                    </div>
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
                    <div className="flex flex-wrap gap-2">
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
      </main>
    </div>
  );
};

export default FreelancerProfile;
