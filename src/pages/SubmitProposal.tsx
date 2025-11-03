import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, DollarSign, Clock, Loader2 } from "lucide-react";
import { db, supabase } from "@/lib/supabase";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";

const SubmitProposal = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isConnected, address } = useWallet();
  const { toast } = useToast();

  const [project, setProject] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    coverLetter: '',
    proposedBudget: '',
    estimatedTimeline: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (projectId && address) {
      loadData();
    }
  }, [projectId, address]);

  const loadData = async () => {
    if (!projectId || !address) return;

    try {
      setLoading(true);

      // Load project
      const projectData = await db.getProject(projectId);
      if (!projectData) {
        toast({
          title: "Project Not Found",
          description: "The project doesn't exist or has been removed",
          variant: "destructive"
        });
        navigate('/browse-services');
        return;
      }

      // Check if project already has a freelancer
      if (projectData.freelancer_id) {
        toast({
          title: "Project Unavailable",
          description: "This project already has a freelancer assigned",
          variant: "destructive"
        });
        navigate(`/service/${projectId}`);
        return;
      }

      // Check if user is the project owner
      if (projectData.client_id === address) {
        toast({
          title: "Cannot Submit Proposal",
          description: "You cannot submit a proposal to your own project",
          variant: "destructive"
        });
        navigate(`/project/${projectId}`);
        return;
      }

      setProject(projectData);

      // Load user profile
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', address)
        .maybeSingle();

      if (profiles) {
        setProfile(profiles);
      }

      // Pre-fill budget with project budget
      setFormData(prev => ({
        ...prev,
        proposedBudget: projectData.budget_usdc.toString()
      }));

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.coverLetter.trim()) {
      errors.coverLetter = "Cover letter is required";
    } else if (formData.coverLetter.trim().length < 50) {
      errors.coverLetter = "Cover letter must be at least 50 characters";
    }

    if (!formData.proposedBudget) {
      errors.proposedBudget = "Proposed budget is required";
    } else if (parseFloat(formData.proposedBudget) <= 0) {
      errors.proposedBudget = "Budget must be greater than 0";
    }

    if (!formData.estimatedTimeline) {
      errors.estimatedTimeline = "Estimated timeline is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to submit a proposal",
        variant: "destructive",
      });
      return;
    }

    if (!profile) {
      toast({
        title: "Profile Required",
        description: "Please create a freelancer profile before submitting proposals",
        variant: "destructive",
      });
      navigate('/create-profile');
      return;
    }

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors below",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create proposal
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          project_id: projectId,
          freelancer_id: profile.id,
          proposed_budget: parseFloat(formData.proposedBudget),
          estimated_timeline: formData.estimatedTimeline,
          cover_letter: formData.coverLetter.trim(),
          milestones: null
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Proposal Submitted!",
        description: "Your proposal has been sent to the client",
      });

      // Navigate back to service details
      navigate(`/service/${projectId}`);

    } catch (error: any) {
      console.error('Error submitting proposal:', error);
      toast({
        title: "Failed to Submit Proposal",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading project...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Wallet Required</h2>
            <p className="text-muted-foreground mb-6">Please connect your wallet to submit a proposal.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-4">Project Not Found</h2>
            <p className="text-muted-foreground mb-6">The project doesn't exist or has been removed.</p>
            <Link to="/browse-services">
              <Button>Browse Projects</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link to="/" className="inline-flex mb-6">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Submit Your Proposal
            </h1>
            <p className="text-lg text-muted-foreground">
              Convince the client why you're the best fit for this project
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>Proposal Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cover Letter */}
                  <div className="space-y-2">
                    <Label htmlFor="coverLetter">
                      Cover Letter *
                      <span className="text-xs text-muted-foreground ml-2">
                        ({formData.coverLetter.length} characters)
                      </span>
                    </Label>
                    <Textarea
                      id="coverLetter"
                      placeholder="Introduce yourself, explain your relevant experience, and why you're the perfect fit for this project..."
                      rows={10}
                      className={`bg-muted/50 ${formErrors.coverLetter ? 'border-destructive' : ''}`}
                      value={formData.coverLetter}
                      onChange={(e) => handleInputChange('coverLetter', e.target.value)}
                    />
                    {formErrors.coverLetter && (
                      <p className="text-sm text-destructive">{formErrors.coverLetter}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Minimum 50 characters. Be specific about how you can help.
                    </p>
                  </div>

                  {/* Budget and Timeline */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="proposedBudget">Proposed Budget (USDC) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          id="proposedBudget"
                          type="number"
                          placeholder="5000"
                          className={`pl-9 bg-muted/50 ${formErrors.proposedBudget ? 'border-destructive' : ''}`}
                          value={formData.proposedBudget}
                          onChange={(e) => handleInputChange('proposedBudget', e.target.value)}
                        />
                      </div>
                      {formErrors.proposedBudget && (
                        <p className="text-sm text-destructive">{formErrors.proposedBudget}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Client's budget: ${project.budget_usdc}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimatedTimeline">Estimated Timeline *</Label>
                      <Select
                        value={formData.estimatedTimeline}
                        onValueChange={(value) => handleInputChange('estimatedTimeline', value)}
                      >
                        <SelectTrigger className={`bg-muted/50 ${formErrors.estimatedTimeline ? 'border-destructive' : ''}`}>
                          <SelectValue placeholder="Select timeline" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-week">1 Week</SelectItem>
                          <SelectItem value="2-weeks">2 Weeks</SelectItem>
                          <SelectItem value="1-month">1 Month</SelectItem>
                          <SelectItem value="2-months">2 Months</SelectItem>
                          <SelectItem value="3-months">3+ Months</SelectItem>
                        </SelectContent>
                      </Select>
                      {formErrors.estimatedTimeline && (
                        <p className="text-sm text-destructive">{formErrors.estimatedTimeline}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Client expects: {project.timeline}
                      </p>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Submit Proposal
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Project Summary */}
            <div className="space-y-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-lg">Project Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">{project.title}</h3>
                    <Badge variant="secondary">{project.category}</Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-medium">${project.budget_usdc}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timeline</span>
                      <span className="font-medium">{project.timeline}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Posted</span>
                      <span className="font-medium">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {project.required_skills && project.required_skills.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-sm">Required Skills</h4>
                      <div className="flex flex-wrap gap-1">
                        {project.required_skills.map((skill: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tips Card */}
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-3">💡 Pro Tips</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Highlight relevant experience</li>
                    <li>• Be specific about your approach</li>
                    <li>• Mention similar projects you've completed</li>
                    <li>• Ask clarifying questions if needed</li>
                    <li>• Be professional and concise</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SubmitProposal;
