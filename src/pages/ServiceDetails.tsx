import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Header from "@/components/Header";
import { Star, Clock, DollarSign, Shield, MessageCircle, ArrowLeft, User, Award, TrendingUp } from "lucide-react";
import { db } from "@/lib/supabase";
import { useWallet } from "@/hooks/useWallet";
import { toast } from "@/hooks/use-toast";

interface ServiceDetails {
  id: string;
  title: string;
  description: string;
  category: string;
  budget_usdc: number;
  timeline: string;
  required_skills: string[];
  status: string;
  created_at: string;
  client_id: string;
  freelancer_id?: string;
  project_images?: string[];
  freelancer?: {
    id: string;
    full_name: string;
    username: string;
    bio: string;
    rating: number;
    total_earned: number;
    completed_projects: number;
    skills: string[];
    hourly_rate: number;
  };
}

const ServiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const [service, setService] = useState<ServiceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadServiceDetails(id);
    }
  }, [id]);

  const loadServiceDetails = async (serviceId: string) => {
    try {
      setLoading(true);
      const project = await db.getProject(serviceId);
      
      if (project) {
        let freelancerData = null;
        if (project.freelancer_id) {
          freelancerData = await db.getProfile(project.freelancer_id);
        }
        
        setService({
          ...project,
          freelancer: freelancerData
        } as ServiceDetails);
      }
    } catch (error) {
      console.error('Error loading service details:', error);
      toast({
        title: "Error",
        description: "Failed to load service details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (!isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to contact the freelancer",
        variant: "destructive"
      });
      return;
    }
    
    if (service?.freelancer_id) {
      navigate(`/messages?recipient=${service.freelancer_id}`);
    }
  };

  const handleHire = () => {
    if (!isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to hire this freelancer",
        variant: "destructive"
      });
      return;
    }
    
    if (service?.freelancer_id) {
      navigate(`/post-project?preselectedFreelancerId=${service.freelancer_id}`);
    }
  };

  const handleSubmitProposal = () => {
    if (!isConnected) {
      toast({
        title: "Connect Wallet",
        description: "Please connect your wallet to submit a proposal",
        variant: "destructive"
      });
      return;
    }
    
    navigate(`/view-proposals/${service?.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-64"></div>
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Service Not Found</h1>
            <Button onClick={() => navigate('/browse-services')}>
              Browse All Services
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Header */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="secondary">{service.category}</Badge>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      ${service.budget_usdc}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Fixed Price
                    </div>
                  </div>
                </div>
                <CardTitle className="text-2xl">{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Project Image */}
                {service.project_images && service.project_images.length > 0 && (
                  <div className="w-full">
                    <img 
                      src={service.project_images[0]} 
                      alt={service.title}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold mb-3">Project Description</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">Delivery Time</div>
                      <div className="text-sm text-muted-foreground">{service.timeline}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-web3-success" />
                    <div>
                      <div className="font-medium">Escrow Protected</div>
                      <div className="text-sm text-muted-foreground">Secure payments</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.required_skills?.map((skill, index) => (
                      <Badge key={index} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Open for Proposals */}
            {!service.freelancer && (
              <Card className="border-accent-blue bg-accent-blue/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-accent-blue" />
                    Open for Proposals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    This project is actively seeking talented freelancers. Submit your proposal to be considered for this opportunity.
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-accent-green" />
                    <span className="text-muted-foreground">Payments protected by escrow</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Freelancer Info */}
            {service.freelancer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    About the Freelancer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {service.freelancer.full_name?.charAt(0) || 'F'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold">{service.freelancer.full_name}</h3>
                      <p className="text-muted-foreground">@{service.freelancer.username}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{service.freelancer.rating || 5.0}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {service.freelancer.completed_projects} projects completed
                        </div>
                      </div>
                    </div>
                  </div>

                  {service.freelancer.bio && (
                    <div>
                      <h4 className="font-medium mb-2">Bio</h4>
                      <p className="text-muted-foreground">{service.freelancer.bio}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <TrendingUp className="h-6 w-6 mx-auto mb-2 text-web3-success" />
                      <div className="text-2xl font-bold">${service.freelancer.total_earned}</div>
                      <div className="text-sm text-muted-foreground">Total Earned</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <Award className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <div className="text-2xl font-bold">{service.freelancer.completed_projects}</div>
                      <div className="text-sm text-muted-foreground">Projects Done</div>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <DollarSign className="h-6 w-6 mx-auto mb-2 text-web3-warning" />
                      <div className="text-2xl font-bold">${service.freelancer.hourly_rate}</div>
                      <div className="text-sm text-muted-foreground">Per Hour</div>
                    </div>
                  </div>

                  {service.freelancer.skills && (
                    <div>
                      <h4 className="font-medium mb-3">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {service.freelancer.skills.map((skill, index) => (
                          <Badge key={index} variant="outline">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Get Started</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">
                    ${service.budget_usdc}
                  </div>
                  <div className="text-muted-foreground">Fixed Price Project</div>
                </div>

                <Separator />

                <div className="space-y-3">
                  {service.freelancer ? (
                    <>
                      <Button 
                        className="w-full"
                        onClick={handleHire}
                      >
                        Hire Now
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleContact}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Contact Freelancer
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        className="w-full"
                        onClick={handleSubmitProposal}
                      >
                        Submit Proposal
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Pitch your skills and win this project
                      </p>
                    </>
                  )}
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4 text-web3-success" />
                    <span>Secured by blockchain escrow</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trust & Safety */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trust & Safety</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-web3-success" />
                  <div>
                    <div className="font-medium">Escrow Protection</div>
                    <div className="text-sm text-muted-foreground">
                      Your payment is held securely until work is completed
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <div>
                    <div className="font-medium">Verified Reviews</div>
                    <div className="text-sm text-muted-foreground">
                      All reviews are from verified transactions
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceDetails;