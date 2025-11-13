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
  Edit,
  Loader2
} from "lucide-react";
import { db, supabase, Project, Escrow, Profile, WorkSubmission } from "@/lib/supabase";
import SubmitWorkDialog from "@/components/SubmitWorkDialog";
import WorkSubmissionReview from "@/components/WorkSubmissionReview";
import { formatUSDC, formatSOL } from "@/lib/solana";
import { getSolanaPrice } from "@/lib/solana-price";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/hooks/useProfile";
import { useEscrow } from "@/hooks/useEscrow";
import { useRateLimit } from "@/hooks/useRateLimit";
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

// Admin wallet address - can edit any project
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useWallet();
  const { ensureProfile } = useProfile();
  const { releasePaymentToFreelancer, isLoading: escrowLoading } = useEscrow();
  
  const [project, setProject] = useState<Project | null>(null);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [client, setClient] = useState<Profile | null>(null);
  const [freelancer, setFreelancer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [proposalCount, setProposalCount] = useState(0);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [workSubmissions, setWorkSubmissions] = useState<WorkSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [kickingOffFreelancer, setKickingOffFreelancer] = useState(false);
  const [showKickOffDialog, setShowKickOffDialog] = useState(false);
  const { canProceed: canComplete } = useRateLimit({ minTimeBetweenCalls: 2000, actionName: 'completing a project' });
  const { canProceed: canKickOff } = useRateLimit({ minTimeBetweenCalls: 2000, actionName: 'kicking off a freelancer' });
  
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${fieldName} copied to clipboard`,
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

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

      // Load work submissions if project is in progress
      if (projectData.status === 'in_progress' && projectData.freelancer_id) {
        await loadWorkSubmissions();
      }

          // Load escrow if exists
          try {
            const escrowData = await db.getEscrow(id);
            setEscrow(escrowData);
            
            
            // Load SOL price if escrow was paid with SOL (or if payment_currency is not set, assume SOLANA for older escrows)
            const paymentCurrency = escrowData.payment_currency || 'SOLANA';
            if (paymentCurrency === 'SOLANA') {
              try {
                const priceData = await getSolanaPrice();
                setSolPrice(priceData.price_usd);
              } catch (error) {
                console.error('Error loading SOL price:', error);
              }
            }
          } catch (error) {
            // Escrow doesn't exist
          }

      // Load client profile by wallet address
      if (projectData.client_id) {
        try {
          const clientData = await db.getProfileByWallet(projectData.client_id);
          setClient(clientData);
        } catch (error) {
        }
      }

      // Load freelancer profile by ID
      if (projectData.freelancer_id) {
        try {
          const freelancerData = await db.getProfile(projectData.freelancer_id);
          setFreelancer(freelancerData);
        } catch (error) {
        }
      } else {
        // Load proposal count if no freelancer assigned
        // Apply the same filtering logic as ViewProposals to exclude old proposals from kicked-off freelancers
        try {
          const proposals = await db.getProposals(id);
          
          // If project has started_at, filter out proposals from previously assigned freelancers
          if (projectData.started_at) {
            try {
              // Get all work submissions to find which freelancers were previously assigned
              const workSubmissions = await db.getWorkSubmissions(id);
              const freelancerIdsFromWork = new Set(
                workSubmissions.map(sub => sub.freelancer_id).filter(Boolean)
              );
              
              // Check escrow to find the previously assigned freelancer's wallet
              let freelancerIdsFromEscrow = new Set<string>();
              try {
                const escrow = await db.getEscrow(id);
                if (escrow && escrow.freelancer_wallet) {
                  const freelancerProfile = await db.getProfileByWallet(escrow.freelancer_wallet);
                  if (freelancerProfile?.id) {
                    freelancerIdsFromEscrow.add(freelancerProfile.id);
                  }
                }
              } catch (escrowError) {
                // Ignore escrow errors
              }
              
              // Combine both strategies
              const previouslyAssignedFreelancerIds = new Set([
                ...Array.from(freelancerIdsFromWork),
                ...Array.from(freelancerIdsFromEscrow)
              ]);
              
              // Filter out only OLD proposals from previously assigned freelancers (created before started_at)
              // Allow NEW proposals from previously assigned freelancers (created after started_at)
              const startedAtDate = new Date(projectData.started_at);
              const validProposals = proposals.filter(proposal => {
                if (!proposal.freelancer_id) return true;
                
                // If this freelancer was previously assigned, only exclude OLD proposals
                if (previouslyAssignedFreelancerIds.has(proposal.freelancer_id)) {
                  const proposalDate = proposal.created_at ? new Date(proposal.created_at) : null;
                  // Exclude if proposal was created before project started (it's an old proposal)
                  if (proposalDate && proposalDate < startedAtDate) {
                    return false;
                  }
                  // Allow if proposal was created after project started (it's a new proposal)
                  return true;
                }
                
                // Exclude if proposal was created before project started (old proposals from any freelancer)
                if (proposal.created_at && new Date(proposal.created_at) < startedAtDate) {
                  return false;
                }
                
                return true;
              });
              
              setProposalCount(validProposals.length);
            } catch (filterError) {
              // If filtering fails, show all proposals count (fallback)
              console.error('Error filtering proposals for count:', filterError);
              setProposalCount(proposals.length);
            }
          } else {
            // Project never had a freelancer assigned, show all proposals
            setProposalCount(proposals.length);
          }
        } catch (error) {
          console.log('Error loading proposal count:', error);
          setProposalCount(0);
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

  const loadWorkSubmissions = async () => {
    if (!id) return;
    
    try {
      setLoadingSubmissions(true);
      const submissions = await db.getWorkSubmissions(id);
      setWorkSubmissions(submissions || []);
    } catch (error) {
      console.error('Error loading work submissions:', error);
    } finally {
      setLoadingSubmissions(false);
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

  const isAdmin = address === ADMIN_WALLET_ADDRESS;
  const isProjectOwner = address && project && (project.client_id === address || isAdmin);
  const isAssignedFreelancer = address && project && project.freelancer_id && freelancer?.wallet_address === address;

  const handleCompleteProject = async () => {
    // Rate limiting check
    if (!canComplete()) {
      return;
    }

    if (!project || !id) return;
    
    // Security: Verify user is authorized (project owner)
    if (!isProjectOwner) {
      toast({
        title: "Unauthorized",
        description: "Only the project owner can complete this project",
        variant: "destructive"
      });
      return;
    }
    
    setCompleting(true);
    try {
      // Security: Verify project is in valid state
      if (project.status !== 'in_progress') {
        throw new Error(`Cannot complete project. Project must be in progress. Current status: ${project.status}`);
      }

      // Get freelancer wallet address from profile
      if (!freelancer?.wallet_address) {
        throw new Error('Freelancer wallet address not found. Cannot complete project without freelancer information.');
      }

      if (!escrow) {
        throw new Error('No escrow found for this project. Cannot release payment.');
      }

      // Security: Verify escrow hasn't already been released
      if (escrow.status === 'released') {
        toast({
          title: "Payment Already Released",
          description: "Payment has already been sent to the freelancer for this project.",
          variant: "destructive"
        });
        return;
      }

      // Release payment to freelancer first (this sends actual funds)
      let paymentReleased = false;
      try {
        paymentReleased = await releasePaymentToFreelancer(
          escrow.id,
          freelancer.wallet_address
        );
      } catch (e) {
        console.error('Payment release failed:', e);
        toast({
          title: "Payment Release Failed",
          description: e instanceof Error ? e.message : "Failed to send payment to freelancer. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Only update project status if payment was successfully released
      if (!paymentReleased) {
        toast({
          title: "Payment Release Failed",
          description: "Payment was not released. Project status was not updated.",
          variant: "destructive"
        });
        return;
      }

      // Update project status to completed only after payment is released
      await db.updateProject(id, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      // Send notifications to both client and freelancer
      try {
        const amount = escrow.amount_usdc;
        const currency = escrow.payment_currency || 'SOLANA';
        await db.sendProjectCompletionNotification(
          id,
          project.client_id,
          freelancer?.wallet_address || null,
          project.title,
          amount,
          currency
        );
      } catch (notificationError) {
        console.error('Error sending notifications:', notificationError);
        // Don't fail the completion if notifications fail
      }

      toast({
        title: 'Project Completed!',
        description: paymentReleased
          ? 'Project has been marked as completed and payment has been sent to freelancer.'
          : 'Project marked as completed.',
      });

      // Reload project details and submissions
      await loadProjectDetails();
      await loadWorkSubmissions();
    } catch (error) {
      console.error('Error completing project:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete project",
        variant: "destructive"
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleKickOffFreelancer = async () => {
    // Rate limiting check
    if (!canKickOff()) {
      return;
    }

    if (!project || !id) return;
    
    // Security: Verify user is authorized (project owner)
    if (!isProjectOwner) {
      toast({
        title: "Unauthorized",
        description: "Only the project owner can kick off a freelancer",
        variant: "destructive"
      });
      return;
    }

    
    setKickingOffFreelancer(true);
    try {
      // CRITICAL: Delete ALL proposals from this freelancer for this project
      // This ensures they can NEVER see their old proposal again - they must submit a new one
      // Do this BEFORE updating the project status to ensure proposals are deleted
      if (freelancer?.id) {
        try {
          const deletedProposals = await db.deleteProposalsByFreelancer(id, freelancer.id);
          
          // Double-check: verify proposals are actually deleted (wait a moment for DB to sync)
          await new Promise(resolve => setTimeout(resolve, 500));
          try {
            const remainingProposals = await db.getProposals(id);
            const stillExists = remainingProposals.some(p => p.freelancer_id === freelancer.id);
            if (stillExists) {
              // Try to delete again
              await db.deleteProposalsByFreelancer(id, freelancer.id);
            }
          } catch (verifyError) {
            // Continue anyway - deletion was attempted
          }
        } catch (proposalError) {
          // Don't fail the kick-off if proposal deletion fails, but log it prominently
          toast({
            title: "Warning",
            description: "Failed to delete proposals from removed freelancer. They may still appear in the proposals list.",
            variant: "destructive"
          });
        }
      }

      // Update project to remove freelancer and set status back to active
      // NOTE: We keep started_at set so we know a freelancer was previously assigned
      await db.updateProject(id, {
        freelancer_id: null,
        status: 'active'
        // DO NOT clear started_at - we need it to know a freelancer was previously assigned
      });

      // Send notification to freelancer
      if (freelancer?.wallet_address) {
        try {
          await db.createMessage({
            sender_id: address!,
            recipient_id: freelancer.wallet_address,
            subject: `Removed from "${project.title}"`,
            content: `You have been removed from the project "${project.title}".`
          });
        } catch (notificationError) {
          console.error('Error sending notification:', notificationError);
          // Don't fail the kick-off if notification fails
        }
      }

      toast({
        title: 'Freelancer Removed',
        description: 'The freelancer has been removed and the project is now active and open for new applications.',
      });

      // Reload project details
      await loadProjectDetails();
      await loadWorkSubmissions();
      setShowKickOffDialog(false);
      
      // Navigate back to project details page
      navigate(`/project/${id}`);
    } catch (error) {
      console.error('Error kicking off freelancer:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove freelancer",
        variant: "destructive"
      });
    } finally {
      setKickingOffFreelancer(false);
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
            <Link to="/dashboard">
              <Button>Back to Dashboard</Button>
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
          <Link to="/dashboard" className="inline-flex mb-6">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
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
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Project Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
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
                      <Badge key={index} variant="secondary" style={{ maxWidth: '240px', wordBreak: 'break-word', whiteSpace: 'normal' }}>
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

              {/* Work Submissions */}
              {project.status === 'in_progress' && workSubmissions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Work Submissions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {workSubmissions.map((submission) => (
                      <WorkSubmissionReview
                        key={submission.id}
                        submission={submission}
                        projectId={project.id}
                        projectTitle={project.title}
                        clientWallet={project.client_id}
                        freelancerWallet={freelancer?.wallet_address || ''}
                        onReviewComplete={loadWorkSubmissions}
                      />
                    ))}
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
                        <div className="text-sm text-muted-foreground mb-1">Status</div>
                        <div className={`font-medium capitalize ${getEscrowStatusColor(escrow.status)}`}>
                          {escrow.status}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Payment Currency</div>
                        <div className="font-medium">
                          {escrow.payment_currency || 'SOLANA'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Total Locked</div>
                        <div className="font-medium text-web3-primary">
                          {(escrow.payment_currency || 'SOLANA') === 'SOLANA' 
                            ? formatSOL(escrow.total_locked)
                            : formatUSDC(escrow.total_locked)
                          }
                          {(escrow.payment_currency || 'SOLANA') === 'SOLANA' && solPrice && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (~{formatUSDC(escrow.total_locked * solPrice)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Project Amount</div>
                        <div className="font-medium">
                          {(escrow.payment_currency || 'SOLANA') === 'SOLANA'
                            ? formatSOL(escrow.amount_usdc)
                            : formatUSDC(escrow.amount_usdc)
                          }
                          {(escrow.payment_currency || 'SOLANA') === 'SOLANA' && solPrice && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (~{formatUSDC(escrow.amount_usdc * solPrice)})
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Platform Fee</div>
                        <div className="font-medium">
                          {(escrow.payment_currency || 'SOLANA') === 'SOLANA'
                            ? formatSOL(escrow.platform_fee)
                            : formatUSDC(escrow.platform_fee)
                          }
                          {(escrow.payment_currency || 'SOLANA') === 'SOLANA' && solPrice && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (~{formatUSDC(escrow.platform_fee * solPrice)})
                            </span>
                          )}
                        </div>
                      </div>
                      {escrow.funded_at && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Funded Date</div>
                          <div className="font-medium text-sm">
                            {new Date(escrow.funded_at).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      {escrow.released_at && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-1">Released Date</div>
                          <div className="font-medium text-sm">
                            {new Date(escrow.released_at).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                    {escrow.escrow_account && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Escrow Account</div>
                        <div 
                          onClick={() => copyToClipboard(escrow.escrow_account!, 'Escrow Account')}
                          className="font-mono text-sm bg-muted p-2 rounded break-all cursor-pointer transition-all duration-200 select-all hover:bg-muted/80"
                          title="Click to copy"
                        >
                          {escrow.escrow_account}
                        </div>
                      </div>
                    )}
                    {escrow.transaction_signature && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Transaction Signature</div>
                        <div 
                          onClick={() => copyToClipboard(escrow.transaction_signature!, 'Transaction Signature')}
                          className="font-mono text-xs bg-muted p-2 rounded break-all cursor-pointer transition-all duration-200 select-all hover:bg-muted/80"
                          title="Click to copy"
                        >
                          {escrow.transaction_signature}
                        </div>
                        <a 
                          href={`https://solscan.io/tx/${escrow.transaction_signature}${import.meta.env.MODE === 'production' ? '?cluster=mainnet-beta' : '?cluster=devnet'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-web3-primary hover:underline mt-1 inline-block"
                        >
                          View on Solscan →
                        </a>
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
                      <Link to={`/freelancer/${freelancer.id}`} className="block mt-4">
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

                     {/* Freelancer: Submit Work Button */}
                     {project.status === 'in_progress' && isAssignedFreelancer && freelancer?.id && (() => {
                       // Check if there's a pending or approved submission
                       const hasActiveSubmission = workSubmissions.some(
                         sub => sub.status === 'pending' || sub.status === 'approved'
                       );
                       
                       return (
                         <SubmitWorkDialog
                           projectId={project.id}
                           freelancerId={freelancer.id}
                           projectTitle={project.title}
                           onSubmissionComplete={loadWorkSubmissions}
                           disabled={hasActiveSubmission}
                         />
                       );
                     })()}

                     {/* Client: Complete Project Button (only if work is approved) */}
                     {project.status === 'in_progress' && isProjectOwner && workSubmissions.some(sub => sub.status === 'approved') && (
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
                               disabled={completing || escrowLoading}
                             >
                               {(completing || escrowLoading) ? (
                                 <>
                                   <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                                   Processing Payment...
                                 </>
                               ) : (
                                 "Complete Project"
                               )}
                             </AlertDialogAction>
                           </AlertDialogFooter>
                         </AlertDialogContent>
                       </AlertDialog>
                     )}

          {/* Client: Kick Off Freelancer Button */}
          {project.status === 'in_progress' && isProjectOwner && project.freelancer_id && (() => {
            const hasApprovedWork = workSubmissions.some(
              sub => sub.status === 'approved'
            );
            
            // Don't show if work is approved
            if (hasApprovedWork) {
              return null;
            }
            
            return (
              <AlertDialog open={showKickOffDialog} onOpenChange={setShowKickOffDialog}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    disabled={kickingOffFreelancer}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Kick Off Freelancer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Kick Off Freelancer</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove the current freelancer from this project? This will:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Remove the freelancer from the project</li>
                        <li>Set the project status back to "Active"</li>
                        <li>Make the project available for other freelancers to apply</li>
                        <li>Send a notification to the removed freelancer</li>
                      </ul>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={kickingOffFreelancer}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleKickOffFreelancer}
                      disabled={kickingOffFreelancer}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {kickingOffFreelancer ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                          Removing...
                        </>
                      ) : (
                        "Kick Off Freelancer"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            );
          })()}
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