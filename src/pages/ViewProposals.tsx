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
  CheckCircle,
  XCircle,
  MessageSquare,
  Star
} from "lucide-react";
import { db, Project, Proposal, Profile } from "@/lib/supabase";
import { formatUSDC } from "@/lib/solana";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
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

const ViewProposals = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isConnected, address } = useWallet();

  const [project, setProject] = useState<Project | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingProposal, setAcceptingProposal] = useState<string | null>(null);
  const [rejectingProposal, setRejectingProposal] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadProjectAndProposals();
    }
  }, [id]);

  const loadProjectAndProposals = async () => {
    if (!id) return;

    try {
      setLoading(true);
      
      // Load project
      const projectData = await db.getProject(id);
      if (!projectData) {
        toast({
          title: "Project Not Found",
          description: "The project doesn't exist or has been removed",
          variant: "destructive"
        });
        navigate('/dashboard');
        return;
      }

      // Check if user is the project owner
      if (!address || projectData.client_id !== address) {
        toast({
          title: "Access Denied",
          description: "You can only view proposals for your own projects",
          variant: "destructive"
        });
        navigate(`/project/${id}`);
        return;
      }

      setProject(projectData);

      // Load proposals for this project
      let proposalsData = await db.getProposals(id);
      
      // CRITICAL: If project has started_at but no freelancer_id, a freelancer was assigned and then removed
      // In this case, we MUST filter out ALL proposals from any freelancer who was previously assigned
      // This prevents showing old proposals from kicked-off freelancers
      if (projectData.status === 'active' && !projectData.freelancer_id && projectData.started_at) {
        try {
          // Strategy 1: Get all work submissions to find which freelancers were previously assigned
          const workSubmissions = await db.getWorkSubmissions(id);
          const freelancerIdsFromWork = new Set(
            workSubmissions.map(sub => sub.freelancer_id).filter(Boolean)
          );
          
          // Strategy 2: Check escrow to find the previously assigned freelancer's wallet
          // Then find their profile ID and add to the set
          let freelancerIdsFromEscrow = new Set<string>();
          try {
            const escrow = await db.getEscrow(id);
            if (escrow && escrow.freelancer_wallet) {
              // Find the profile ID for this wallet address
              const freelancerProfile = await db.getProfileByWallet(escrow.freelancer_wallet);
              if (freelancerProfile?.id) {
                freelancerIdsFromEscrow.add(freelancerProfile.id);
                console.log(`Found previously assigned freelancer from escrow: ${freelancerProfile.id} (wallet: ${escrow.freelancer_wallet})`);
              }
            }
          } catch (escrowError) {
            console.warn('Could not check escrow for previously assigned freelancer:', escrowError);
          }
          
          // Combine both strategies
          const previouslyAssignedFreelancerIds = new Set([
            ...Array.from(freelancerIdsFromWork),
            ...Array.from(freelancerIdsFromEscrow)
          ]);
          
          const startedAtDate = new Date(projectData.started_at);
          
          console.log(`Project was previously started (started_at: ${projectData.started_at}). Previously assigned freelancers:`, Array.from(previouslyAssignedFreelancerIds));
          console.log(`Found ${proposalsData.length} total proposals. Checking which ones to filter...`);
          
          // Filter out only OLD proposals from previously assigned freelancers (created before started_at)
          // Allow NEW proposals from previously assigned freelancers (created after started_at)
          const validProposals = proposalsData.filter(
            proposal => {
              if (!proposal.freelancer_id) return true;
              
              // If this freelancer was previously assigned, only filter out OLD proposals
              if (previouslyAssignedFreelancerIds.has(proposal.freelancer_id)) {
                const proposalDate = proposal.created_at ? new Date(proposal.created_at) : null;
                // If proposal was created before project started, it's an old proposal - filter it out
                if (proposalDate && proposalDate < startedAtDate) {
                  console.log(`❌ Filtering out OLD proposal ${proposal.id} from previously assigned freelancer: ${proposal.freelancer_id} (created: ${proposal.created_at} < started_at: ${projectData.started_at})`);
                  return false;
                }
                // If proposal was created after project started, it's a NEW proposal - allow it
                console.log(`✅ Allowing NEW proposal ${proposal.id} from previously assigned freelancer: ${proposal.freelancer_id} (created: ${proposal.created_at} > started_at: ${projectData.started_at})`);
              }
              
              return true;
            }
          );
          
          // PERMANENTLY DELETE only OLD proposals from previously assigned freelancers
          // Also delete ANY proposal created before started_at (the accepted proposal was created before project started)
          const proposalsToDelete = proposalsData.filter(
            proposal => {
              // Delete if freelancer was previously assigned AND proposal was created before project started
              if (proposal.freelancer_id && previouslyAssignedFreelancerIds.has(proposal.freelancer_id)) {
                const proposalDate = proposal.created_at ? new Date(proposal.created_at) : null;
                if (proposalDate && proposalDate < startedAtDate) {
                  console.log(`🗑️ Deleting OLD proposal ${proposal.id} from previously assigned freelancer ${proposal.freelancer_id} (created: ${proposal.created_at} < started_at: ${projectData.started_at})`);
                  return true;
                }
                // Don't delete NEW proposals from previously assigned freelancers
                return false;
              }
              // Also delete if proposal was created before project started (it's an old proposal from any freelancer)
              if (proposal.created_at && new Date(proposal.created_at) < startedAtDate) {
                console.log(`🗑️ Proposal ${proposal.id} was created before project started (${proposal.created_at} < ${projectData.started_at}) - deleting`);
                return true;
              }
              return false;
            }
          );
          
          console.log(`Found ${proposalsToDelete.length} proposal(s) to delete from previously assigned freelancers or created before project started`);
          
          // Delete proposals synchronously to ensure they're permanently removed
          if (proposalsToDelete.length > 0) {
            console.log(`🗑️ Deleting ${proposalsToDelete.length} proposal(s)...`);
            const deleteResults = await Promise.all(
              proposalsToDelete.map(p => {
                console.log(`🗑️ Deleting proposal ${p.id} from freelancer ${p.freelancer_id} (created: ${p.created_at})`);
                return db.deleteProposal(p.id).catch(err => {
                  console.error(`❌ Error deleting proposal ${p.id}:`, err);
                  return null;
                });
              })
            );
            const successfulDeletes = deleteResults.filter(r => r !== null).length;
            console.log(`✅ Successfully deleted ${successfulDeletes}/${proposalsToDelete.length} proposal(s)`);
            
            // Remove deleted proposals from the list
            const deletedIds = new Set(proposalsToDelete.map(p => p.id));
            const remainingValidProposals = validProposals.filter(p => !deletedIds.has(p.id));
            setProposals(remainingValidProposals);
            console.log(`✅ Showing ${remainingValidProposals.length} valid proposal(s) after deletion`);
          } else {
            console.log(`ℹ️ No proposals found to delete (all proposals are from new freelancers)`);
            setProposals(validProposals);
            console.log(`✅ Showing ${validProposals.length} valid proposal(s) (filtered out ${proposalsData.length - validProposals.length})`);
          }
        } catch (error) {
          // If error checking, show all proposals to be safe
          console.error('❌ Error checking for previously assigned freelancers:', error);
          setProposals(proposalsData);
        }
      } else if (projectData.status === 'active' && !projectData.freelancer_id) {
        // Project is active but never had a freelancer assigned (no started_at)
        // Show all proposals normally
        setProposals(proposalsData);
      } else {
        // Project has a freelancer assigned, show all proposals (normal case)
        setProposals(proposalsData);
      }

    } catch (error) {
      console.error('Error loading project and proposals:', error);
      toast({
        title: "Error",
        description: "Failed to load project details and proposals",
        variant: "destructive"
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProposal = async (proposal: Proposal) => {
    if (!project || !id || !proposal.freelancer_id) return;

    setAcceptingProposal(proposal.id);
    try {
      // Update project to assign freelancer and change status
      await db.updateProject(id, {
        freelancer_id: proposal.freelancer_id,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        budget_usdc: proposal.proposed_budget // Update budget to accepted proposal amount
      });

      // Send notification message to freelancer
      try {
        if (proposal.freelancer?.wallet_address && project && address) {
          await db.createMessage({
            sender_id: address,
            recipient_id: proposal.freelancer.wallet_address,
            subject: `Proposal Accepted for "${project.title}"`,
            content: `Great news! Your proposal for "${project.title}" has been accepted. The project is now in progress. You can start working on it from your dashboard.`
          });
        }
      } catch (messageError) {
        // Don't fail the proposal acceptance if message fails
        console.error('Error sending notification message:', messageError);
      }

      toast({
        title: "Proposal Accepted!",
        description: `You've hired ${proposal.freelancer?.full_name || 'the freelancer'} for this project`,
      });

      // Navigate to project details page
      navigate(`/project/${id}`);
    } catch (error) {
      console.error('Error accepting proposal:', error);
      toast({
        title: "Error",
        description: "Failed to accept proposal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setAcceptingProposal(null);
    }
  };

  const handleRejectProposal = async (proposal: Proposal) => {
    if (!project || !id || !proposal.id) return;

    setRejectingProposal(proposal.id);
    try {
      // Delete the proposal
      await db.deleteProposal(proposal.id);

      // Send notification message to freelancer
      try {
        if (proposal.freelancer?.wallet_address && project && address) {
          await db.createMessage({
            sender_id: address,
            recipient_id: proposal.freelancer.wallet_address,
            subject: `Proposal Not Selected for "${project.title}"`,
            content: `Thank you for your interest. Your proposal for "${project.title}" was not selected for this project. We encourage you to apply to other projects that match your skills.`
          });
        }
      } catch (messageError) {
        // Don't fail the proposal rejection if message fails
        console.error('Error sending notification message:', messageError);
      }

      // Remove proposal from local state
      setProposals(prev => prev.filter(p => p.id !== proposal.id));

      toast({
        title: "Proposal Rejected",
        description: `The proposal from ${proposal.freelancer?.full_name || 'the freelancer'} has been removed`,
      });
    } catch (error) {
      console.error('Error rejecting proposal:', error);
      toast({
        title: "Error",
        description: "Failed to reject proposal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRejectingProposal(null);
    }
  };

  const getTimelineColor = (timeline: string) => {
    switch (timeline.toLowerCase()) {
      case '1-week':
      case '2-weeks':
        return 'text-green-600 bg-green-50 border-green-200';
      case '1-month':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
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
              <p className="mt-4 text-muted-foreground">Loading proposals...</p>
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
            <p className="text-muted-foreground mb-6">Please connect your wallet to view proposals.</p>
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <Link to="/" className="inline-flex mb-6">
            <Button variant="ghost">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Proposals for "{project.title}"</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Posted {new Date(project.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                Budget: {formatUSDC(project.budget_usdc)}
              </div>
              <Badge variant="secondary">{project.category}</Badge>
            </div>
          </div>

          {/* Proposals List */}
          {proposals.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Proposals Yet</h3>
                  <p>Your project hasn't received any proposals yet. Here are some tips to attract more freelancers:</p>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mb-6 text-left max-w-md mx-auto">
                  <li>• Provide detailed project requirements</li>
                  <li>• Set a competitive budget</li>
                  <li>• Respond quickly to questions</li>
                  <li>• Share your project on social media</li>
                </ul>
                <Link to={`/project/${id}/edit`}>
                  <Button variant="outline">Edit Project Details</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="text-sm text-muted-foreground mb-4">
                {proposals.length} proposal{proposals.length === 1 ? '' : 's'} received
              </div>
              
              {proposals.map((proposal) => (
                <Card key={proposal.id} className="border-border/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Freelancer Info */}
                      <div className="flex items-start gap-4 lg:flex-1 min-w-0">
                        <Avatar className="w-12 h-12 flex-shrink-0">
                          <AvatarImage src="" />
                          <AvatarFallback>
                            {proposal.freelancer?.full_name?.split(' ').map(n => n[0]).join('') || 'FL'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {proposal.freelancer?.full_name || proposal.freelancer?.username || 'Anonymous'}
                            </h3>
                            <div className="flex items-center text-yellow-500 flex-shrink-0">
                              <Star className="w-4 h-4 fill-current" />
                              <span className="text-sm ml-1">
                                {proposal.freelancer?.rating ? proposal.freelancer.rating.toFixed(1) : 'New'}
                              </span>
                            </div>
                          </div>
                          
                          {proposal.freelancer && (
                            <div className="text-sm text-muted-foreground mb-3">
                              <div className="flex flex-wrap gap-3">
                                {proposal.freelancer.hourly_rate && (
                                  <span>${proposal.freelancer.hourly_rate}/hr</span>
                                )}
                                <span>{proposal.freelancer.completed_projects || 0} projects completed</span>
                                <span>
                                  {formatUSDC(proposal.freelancer.total_earned || 0)} earned
                                </span>
                              </div>
                            </div>
                          )}

                          <p className="text-muted-foreground mb-4 leading-relaxed whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word' }}>
                            {proposal.cover_letter}
                          </p>

                          {/* Skills */}
                          {proposal.freelancer?.skills && proposal.freelancer.skills.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                              {proposal.freelancer.skills.slice(0, 5).map((skill, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                              {proposal.freelancer.skills.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{proposal.freelancer.skills.length - 5} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Proposal Details */}
                      <div className="lg:w-80 space-y-4">
                        <Card className="bg-muted/30">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Proposed Budget</span>
                              <span className="font-semibold text-lg text-web3-primary">
                                {formatUSDC(proposal.proposed_budget)}
                              </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Timeline</span>
                              <Badge className={getTimelineColor(proposal.estimated_timeline)} variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                {proposal.estimated_timeline}
                              </Badge>
                            </div>
                            
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Submitted</span>
                              <span className="text-sm">
                                {new Date(proposal.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          {proposal.freelancer?.wallet_address && (
                            <MessageDialog
                              recipientId={proposal.freelancer.wallet_address}
                              recipientName={proposal.freelancer.full_name || proposal.freelancer.username || 'Freelancer'}
                              projectTitle={project.title}
                              triggerClassName="w-full"
                              triggerVariant="outline"
                            />
                          )}
                          
                          {proposal.freelancer?.id && (
                            <Link to={`/freelancer/${proposal.freelancer.id}`} className="block">
                              <Button variant="outline" size="sm" className="w-full">
                                <User className="w-4 h-4 mr-2" />
                                View Profile
                              </Button>
                            </Link>
                          )}

                          <div className="flex gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  className="flex-1" 
                                  size="sm"
                                  disabled={acceptingProposal === proposal.id || rejectingProposal === proposal.id}
                                >
                                  {acceptingProposal === proposal.id ? (
                                    "Accepting..."
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Accept
                                    </>
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Accept This Proposal?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    You're about to hire {proposal.freelancer?.full_name || 'this freelancer'} for {formatUSDC(proposal.proposed_budget)}. This will:
                                    <ul className="list-disc list-inside mt-2 space-y-1">
                                      <li>Start the project immediately</li>
                                      <li>Set up escrow with the proposed budget</li>
                                      <li>Reject all other proposals</li>
                                      <li>Begin milestone tracking</li>
                                    </ul>
                                    This action cannot be undone easily.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleAcceptProposal(proposal)}
                                    disabled={acceptingProposal === proposal.id}
                                  >
                                    Accept & Hire
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="destructive"
                                  size="sm"
                                  className="flex-1" 
                                  disabled={rejectingProposal === proposal.id || acceptingProposal === proposal.id}
                                >
                                  {rejectingProposal === proposal.id ? (
                                    "Rejecting..."
                                  ) : (
                                    <>
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Reject
                                    </>
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject This Proposal?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to reject the proposal from {proposal.freelancer?.full_name || 'this freelancer'}? This will remove the proposal and notify the freelancer. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRejectProposal(proposal)}
                                    disabled={rejectingProposal === proposal.id}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Reject Proposal
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ViewProposals;