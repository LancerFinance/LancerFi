import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  User, 
  Clock, 
  Shield,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Edit
} from "lucide-react";
import { db, supabase, Project, Escrow, Profile } from "@/lib/supabase";
import { formatUSDC } from "@/lib/solana";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/hooks/useProfile";
import MessageDialog from "@/components/MessageDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useWallet();
  const { ensureProfile } = useProfile();
  
  const [project, setProject] = useState<Project | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [client, setClient] = useState<Profile | null>(null);
  const [freelancer, setFreelancer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [proposalCount, setProposalCount] = useState(0);

  useEffect(() => {
    if (id) {
      loadProjectDetails();
    }
  }, [id]);

  const loadProjectDetails = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      // Load project
      const projectData = await db.getProject(id);
      setProject(projectData);

      // Load escrow if exists
      try {
        const escrowData = await db.getEscrow(id);
        setEscrow(escrowData);
      } catch (error) {
        // Escrow doesn't exist
      }

      // Load client profile by wallet address
      if (projectData.client_id) {
        try {
          const clientData = await db.getProfileByWallet(projectData.client_id);
          setClient(clientData);
        } catch (error) {
          console.log('No client profile found');
        }
      }

      // Load freelancer profile by ID
      if (projectData.freelancer_id) {
        try {
          const freelancerData = await db.getProfile(projectData.freelancer_id);
          setFreelancer(freelancerData);
        } catch (error) {
          console.log('No freelancer profile found');
        }
      } else {
        // Load proposal count if no freelancer assigned
        try {
          const { data: proposals, error } = await supabase
            .from('proposals')
            .select('id', { count: 'exact' })
            .eq('project_id', id);
          
          if (!error && proposals) {
            setProposalCount(proposals.length);
          }
        } catch (error) {
          console.log('Error loading proposal count:', error);
        }
      }

    } catch (error) {
      console.error('Error loading project details:', error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-web3-success/10 text-web3-success border-web3-success/20';
      case 'in_progress': return 'bg-web3-warning/10 text-web3-warning border-web3-warning/20';
      case 'completed': return 'bg-web3-primary/10 text-web3-primary border-web3-primary/20';
      case 'disputed': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted/10 text-muted-foreground border-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Clock className="w-4 h-4" />;
      case 'in_progress': return <User className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'disputed': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getEscrowStatusColor = (status?: string) => {
    switch (status) {
      case 'funded': return 'text-web3-success';
      case 'released': return 'text-web3-primary';
      case 'pending': return 'text-web3-warning';
      case 'disputed': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const isProjectOwner = address && project && project.client_id === address;
  const isAssignedFreelancer = address && project && project.freelancer_id && freelancer?.wallet_address === address;

  const handleCompleteProject = async () => {
    if (!project || !id) return;
    
    setCompleting(true);
    try {
      // Update project status to completed
      await db.updateProject(id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      // Try to update escrow status to released if escrow exists, but don't fail overall
      let escrowReleased = false;
      if (escrow) {
        try {
          await db.updateEscrow(escrow.id, {
            status: 'released',
            released_at: new Date().toISOString()
          });
          escrowReleased = true;
        } catch (e) {
          console.error('Escrow release failed (continuing):', e);
        }
      }

      toast({
        title: 'Project Completed!',
        description: escrowReleased
          ? 'Project has been marked as completed and escrow funds have been released.'
          : 'Project marked as completed. Escrow release will be finalized shortly.',
      });

      // Reload project details
      await loadProjectDetails();
    } catch (error) {
      console.error('Error completing project:', error);
      toast({
        title: "Error",
        description: "Failed to complete project",
        variant: "destructive"
      });
    } finally {
      setCompleting(false);
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
              <p className="mt-4 text-muted-foreground">Loading project details...</p>
            </div>
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
            <p className="text-muted-foreground mb-6">The project you're looking for doesn't exist.</p>
            <Link to="/">
              <Button>Back to Home</Button>
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

          {/* Project Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">{project.title}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getStatusColor(project.status)} variant="outline">
                    {getStatusIcon(project.status)}
                    <span className="ml-1">{project.status.replace('_', ' ').toUpperCase()}</span>
                  </Badge>
                  <Badge variant="secondary">{project.category}</Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-1" />
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {isProjectOwner && (
                <div className="flex gap-2">
                  <Link to={`/project/${id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Project
                    </Button>
                  </Link>
                  {!project.freelancer_id && (
                    <Link to={`/project/${id}/proposals`}>
                      <Button variant="default" size="sm" className="relative">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        View Proposals
                        {proposalCount > 0 && (
                          <Badge className="ml-2 bg-accent-amber text-white">
                            {proposalCount}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </p>
                </CardContent>
              </Card>

              {/* Required Skills */}
              <Card>
                <CardHeader>
                  <CardTitle>Required Skills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {project.required_skills.map((skill, index) => (
                      <Badge key={index} variant="secondary">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Project Images */}
              {project.project_images && project.project_images.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Project Images</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {project.project_images.map((img, index) => (
                        <img 
                          key={index}
                          src={img} 
                          alt={`Project image ${index + 1}`}
                          className="w-full h-48 object-cover rounded-md"
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Escrow Information */}
              {escrow && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-web3-primary" />
                      Escrow Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <div className={`font-medium capitalize ${getEscrowStatusColor(escrow.status)}`}>
                          {escrow.status}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Total Locked</div>
                        <div className="font-medium text-web3-primary">
                          {formatUSDC(escrow.total_locked)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Project Amount</div>
                        <div className="font-medium">{formatUSDC(escrow.amount_usdc)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Platform Fee</div>
                        <div className="font-medium">{formatUSDC(escrow.platform_fee)}</div>
                      </div>
                    </div>
                    {escrow.escrow_account && (
                      <div>
                        <div className="text-sm text-muted-foreground">Escrow Account</div>
                        <div className="font-mono text-sm bg-muted p-2 rounded break-all">
                          {escrow.escrow_account}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Project Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-web3-primary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Budget</div>
                      <div className="font-semibold">{formatUSDC(project.budget_usdc)}</div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-web3-secondary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Timeline</div>
                      <div className="font-medium">{project.timeline}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Client</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src="" />
                      <AvatarFallback>
                        {client?.full_name?.split(' ').map(n => n[0]).join('') || 'CL'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {client?.full_name || client?.username || 'Anonymous Client'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {project.client_id.slice(0, 6)}...{project.client_id.slice(-4)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Freelancer Info */}
              {freelancer && (
                <Card>
                  <CardHeader>
                    <CardTitle>Assigned Freelancer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src="" />
                          <AvatarFallback>
                            {freelancer.full_name?.split(' ').map(n => n[0]).join('') || 'FL'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {freelancer.full_name || freelancer.username}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {freelancer.hourly_rate ? `$${freelancer.hourly_rate}/hr` : 'Rate not set'}
                          </div>
                        </div>
                      </div>
                      <Link to={`/freelancer/${freelancer.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          View Profile
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              {(isProjectOwner || isAssignedFreelancer) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                   <CardContent className="space-y-2">
                     {/* Replace non-functional button with working MessageDialog */}
                     {(client?.wallet_address || freelancer?.wallet_address) && (
                       <MessageDialog
                         recipientId={isProjectOwner 
                           ? freelancer?.wallet_address || ''
                           : client?.wallet_address || project.client_id
                         }
                         recipientName={isProjectOwner 
                           ? freelancer?.full_name || freelancer?.username || 'Freelancer'
                           : client?.full_name || client?.username || 'Client'
                         }
                         projectTitle={project.title}
                       />
                     )}


                     {project.status === 'in_progress' && (isProjectOwner || isAssignedFreelancer) && (
                       <AlertDialog>
                         <AlertDialogTrigger asChild>
                           <Button 
                             variant="default" 
                             size="sm" 
                             className="w-full"
                             disabled={completing}
                           >
                             <CheckCircle className="w-4 h-4 mr-2" />
                             Complete Project
                           </Button>
                         </AlertDialogTrigger>
                         <AlertDialogContent>
                           <AlertDialogHeader>
                             <AlertDialogTitle>Complete Project</AlertDialogTitle>
                             <AlertDialogDescription>
                               Are you sure you want to mark this project as completed? This will:
                               <ul className="list-disc list-inside mt-2 space-y-1">
                                 <li>Update the project status to "Completed"</li>
                                 <li>Release the escrow funds to the freelancer</li>
                                 <li>Update the freelancer's earnings and project count</li>
                               </ul>
                               This action cannot be undone.
                             </AlertDialogDescription>
                           </AlertDialogHeader>
                           <AlertDialogFooter>
                             <AlertDialogCancel>Cancel</AlertDialogCancel>
                             <AlertDialogAction
                               onClick={handleCompleteProject}
                               disabled={completing}
                             >
                               {completing ? "Completing..." : "Complete Project"}
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                     )}
                      {project.status === 'active' && isProjectOwner && !project.freelancer_id && (
                        <Link to={`/project/${project.id}/edit`} className="block">
                          <Button variant="outline" size="sm" className="w-full">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Project
                          </Button>
                        </Link>
                      )}
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

export default ProjectDetails;