import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useEscrow } from "@/hooks/useEscrow";
import { db, Project } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import WalletButton from "@/components/WalletButton";
import { Clock, DollarSign, User, CheckCircle } from "lucide-react";

const FreelancerDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [proposal, setProposal] = useState({
    cover_letter: "",
    proposed_budget: "",
    estimated_timeline: ""
  });
  const { address, isConnected } = useWallet();
  const { createProjectEscrow, isLoading: escrowLoading } = useEscrow();
  const { toast } = useToast();

  useEffect(() => {
    loadAvailableProjects();
  }, []);

  const loadAvailableProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProjects((data as unknown as Project[]) || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Error",
        description: "Failed to load available projects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleApplyToProject = async (project: Project) => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to apply for projects",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create or get freelancer profile using wallet address as ID
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', address)
        .single();

      let profileId;
      if (existingProfile) {
        profileId = existingProfile.id;
      } else {
        // Create new profile
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            wallet_address: address,
            username: `freelancer_${address.slice(-6)}`
          })
          .select()
          .single();
        
        if (createError) throw createError;
        profileId = newProfile.id;
      }

      // Update project to assign freelancer
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          freelancer_id: profileId,
          status: 'in_progress'
        })
        .eq('id', project.id);

      if (updateError) throw updateError;

      // Create escrow for the project
      const escrowId = await createProjectEscrow(project.id, project.budget_usdc);
      
      if (escrowId) {
        toast({
          title: "Success!",
          description: "Project assigned and escrow created. Ready for testing!",
        });
        
        // Refresh projects
        loadAvailableProjects();
        setSelectedProject(null);
        setProposal({ cover_letter: "", proposed_budget: "", estimated_timeline: "" });
      }
    } catch (error) {
      console.error('Error applying to project:', error);
      toast({
        title: "Error",
        description: "Failed to apply to project",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading available projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Freelancer Dashboard</h1>
            <p className="text-muted-foreground mt-2">Browse and apply to available projects</p>
          </div>
          <WalletButton />
        </div>

        {!isConnected ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Connect Your Wallet</CardTitle>
              <CardDescription>
                Connect your wallet to browse available projects and apply as a freelancer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WalletButton className="w-full" />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="h-full flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{project.title}</CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">{project.category}</Badge>
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                          {project.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-3">
                    {project.description}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{project.budget_usdc} USDC</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{project.timeline}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="text-sm">Client: {project.client_id?.slice(0, 6)}...{project.client_id?.slice(-4)}</span>
                    </div>

                    {project.required_skills && project.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {project.required_skills.map((skill, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6">
                    {project.status === 'active' ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="w-full" 
                            onClick={() => setSelectedProject(project)}
                          >
                            Apply to Project
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Apply to: {project.title}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="cover_letter">Cover Letter</Label>
                              <Textarea
                                id="cover_letter"
                                placeholder="Tell the client why you're the best fit for this project..."
                                value={proposal.cover_letter}
                                onChange={(e) => setProposal({
                                  ...proposal,
                                  cover_letter: e.target.value
                                })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="proposed_budget">Proposed Budget (USDC)</Label>
                              <Input
                                id="proposed_budget"
                                type="number"
                                placeholder={project.budget_usdc.toString()}
                                value={proposal.proposed_budget}
                                onChange={(e) => setProposal({
                                  ...proposal,
                                  proposed_budget: e.target.value
                                })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="estimated_timeline">Estimated Timeline</Label>
                              <Input
                                id="estimated_timeline"
                                placeholder="e.g., 2 weeks"
                                value={proposal.estimated_timeline}
                                onChange={(e) => setProposal({
                                  ...proposal,
                                  estimated_timeline: e.target.value
                                })}
                              />
                            </div>
                            <Button 
                              className="w-full" 
                              onClick={() => handleApplyToProject(project)}
                              disabled={escrowLoading || !proposal.cover_letter}
                            >
                              {escrowLoading ? "Creating Escrow..." : "Apply & Test Escrow"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Project Taken</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {projects.length === 0 && isConnected && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>No Projects Available</CardTitle>
              <CardDescription>
                There are currently no active projects available. Check back later!
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FreelancerDashboard;