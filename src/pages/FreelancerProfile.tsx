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
import { supabase, Profile } from "@/lib/supabase";
import MessageDialog from "@/components/MessageDialog";
import { getSolanaPrice } from "@/lib/solana-price";

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
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
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
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Past Works ({projects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => (
            <div key={project.id} className="space-y-2">
              <Link to={`/project/${project.id}`}>
                <h4 className="font-semibold hover:text-primary transition-colors">
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
  const [usdEarned, setUsdEarned] = useState<number>(0);

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
      
      // Calculate total earned in USD
      let totalEarnedUSD: number = 0;
      if (data?.id) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('freelancer_id', data.id);
        
        const projectIds = (projects || []).map((p: any) => p.id);

        if (projectIds.length > 0) {
          // Fetch payment_currency to know if amount_usdc is in SOL or USD
          const { data: escrows } = await supabase
            .from('escrows')
            .select('amount_usdc, payment_currency')
            .in('project_id', projectIds)
            .eq('status', 'released');
            
          if (escrows && escrows.length > 0) {
            // Separate SOL and USD earnings
            let solEarnings = 0;
            let usdEarnings = 0;
            
            escrows.forEach((e: any) => {
              const amount = Number(e.amount_usdc || 0);
              const currency = e.payment_currency || 'SOLANA';
              
              if (currency === 'SOLANA') {
                solEarnings += amount;
              } else {
                usdEarnings += amount;
              }
            });
            
            // Convert SOL to USD
            if (solEarnings > 0) {
              try {
                const priceData = await getSolanaPrice();
                const solPrice = priceData.price_usd;
                usdEarnings += solEarnings * solPrice;
              } catch (error) {
                console.error('Error fetching SOL price:', error);
                // Use fallback price of $100
                usdEarnings += solEarnings * 100;
              }
            }
            
            totalEarnedUSD = usdEarnings;
          }
        }
      }
      
      // If no escrows found, convert database total_earned (SOL) to USD
      if (totalEarnedUSD === 0 && data?.total_earned && data.total_earned > 0) {
        try {
          const priceData = await getSolanaPrice();
          const solPrice = priceData.price_usd;
          totalEarnedUSD = data.total_earned * solPrice;
        } catch (error) {
          console.error('Error fetching SOL price:', error);
          // Use fallback price of $100
          totalEarnedUSD = data.total_earned * 100;
        }
      }
      
      setUsdEarned(totalEarnedUSD);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-accent-green';
      case 'busy': return 'text-accent-amber';
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
      
      <main className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex mb-6">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        {/* Banner Image */}
        {profile.banner_url && (
          <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] h-64 overflow-hidden mb-6 md:w-full md:left-auto md:right-auto md:ml-0 md:mr-0">
            <img 
              src={profile.banner_url} 
              alt="Profile banner" 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="max-w-6xl mx-auto">
          {/* Profile Photo and Header */}
          <div className="relative mb-8">
            {/* Avatar positioned over banner */}
            <div className={`${profile.banner_url ? '-mt-16' : 'mt-6'} mb-6`}>
              <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                <AvatarImage src={profile.profile_photo_url || ''} />
                <AvatarFallback className="text-3xl">
                  {profile.full_name?.split(' ').map(n => n[0]).join('') || profile.username?.[0]?.toUpperCase() || 'FL'}
                </AvatarFallback>
              </Avatar>
            </div>
            
            {/* Name and buttons below banner */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {profile.full_name || profile.username}
                </h1>
                <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
                  {profile.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {profile.location}
                    </div>
                  )}
                  {profile.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-accent-amber text-accent-amber" />
                      {profile.rating.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/post-project?freelancer=${profile.id}`}>
                  <Button size="lg">
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* About */}
              <Card className="border-border bg-card">
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
              <Card className="border-border bg-card">
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
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" />
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
              <Card className="border-border bg-card">
                <CardContent className="p-6 space-y-4">
                  <div className={`inline-flex items-center gap-2 ${getAvailabilityColor(profile.availability_status || 'available')}`}>
                    <div className="w-2 h-2 rounded-full bg-current"></div>
                    <span className="font-medium">{getAvailabilityText(profile.availability_status || 'available')}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-accent-amber text-accent-amber" />
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
                      <div className="font-bold">${usdEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      <span className="text-xs text-muted-foreground">Earned</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Experience */}
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-primary" />
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
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Languages className="w-5 h-5 text-primary" />
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
                <Card className="border-border bg-card">
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
