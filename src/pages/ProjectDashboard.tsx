import { useState, useEffect } from 'react';
import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Filter, Search, Wallet, Briefcase, Wrench, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { db, Project, Escrow } from "@/lib/supabase";
import { formatUSDC, formatSOL } from "@/lib/solana";
import { getSolanaPrice } from "@/lib/solana-price";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_CATEGORIES } from "@/lib/categories";

const ProjectDashboard = () => {
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [postedProjects, setPostedProjects] = useState<Project[]>([]);
  const [workingProjects, setWorkingProjects] = useState<Project[]>([]);
  const [escrows, setEscrows] = useState<Record<string, Escrow>>({});
  const [proposalCounts, setProposalCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [solPrice, setSolPrice] = useState<number | null>(null);

  useEffect(() => {
    if (address) {
      // Reset state before loading new wallet's projects
      setPostedProjects([]);
      setWorkingProjects([]);
      setEscrows({});
      setProposalCounts({});
      setLoading(true);
      loadProjects();
    } else {
      // Clear projects when wallet disconnects
      setPostedProjects([]);
      setWorkingProjects([]);
      setEscrows({});
      setProposalCounts({});
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    // Load SOL price for converting SOL amounts to USD in stats
    getSolanaPrice().then(priceData => {
      setSolPrice(priceData.price_usd);
    }).catch(() => {
      setSolPrice(100); // Fallback
    });
  }, []);

  const loadProjects = async () => {
    // Get current address at the time of execution (not from closure)
    const currentAddress = address;
    if (!currentAddress) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Get user profile to find their profile ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', currentAddress)
        .maybeSingle();

      // Load projects POSTED by me (as client)
      const { data: clientProjects, error: clientError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', currentAddress)
        .order('created_at', { ascending: false });
      
      if (clientError) throw clientError;
      setPostedProjects(clientProjects || []);

      // Load projects I'm WORKING ON (as freelancer)
      let freelancerProjects: Project[] = [];
      if (profileData?.id) {
        const { data: workProjects, error: workError } = await supabase
          .from('projects')
          .select('*')
          .eq('freelancer_id', profileData.id)
          .order('created_at', { ascending: false });
        
        if (!workError) {
          freelancerProjects = workProjects || [];
        }
      }
      setWorkingProjects(freelancerProjects);

      // Load escrows and proposal counts for all projects in parallel
      const allProjects = [...(clientProjects || []), ...freelancerProjects];
      const escrowData: Record<string, Escrow> = {};
      const proposalCountData: Record<string, number> = {};
      
      // Load all escrows in parallel
      const escrowPromises = allProjects.map(async (project) => {
        try {
          const escrow = await db.getEscrow(project.id);
          return { projectId: project.id, escrow };
        } catch (error) {
          return { projectId: project.id, escrow: null };
        }
      });
      
      const escrowResults = await Promise.all(escrowPromises);
      escrowResults.forEach(({ projectId, escrow }) => {
        if (escrow) {
          escrowData[projectId] = escrow;
        }
      });

      // Load proposal counts for projects without freelancers (only for posted projects)
      const projectsNeedingProposals = allProjects.filter(
        project => !project.freelancer_id && project.client_id === currentAddress
      );

      // Load all proposals in parallel
      const proposalPromises = projectsNeedingProposals.map(async (project) => {
        try {
          const proposals = await db.getProposals(project.id);
          return { project, proposals };
        } catch (error) {
          console.log(`Error loading proposals for project ${project.id}:`, error);
          return { project, proposals: [] };
        }
      });

      const proposalResults = await Promise.all(proposalPromises);

      // Load all work submissions in parallel for projects that need filtering
      const projectsNeedingFiltering = proposalResults.filter(
        ({ project }) => project.started_at
      );

      const workSubmissionPromises = projectsNeedingFiltering.map(async ({ project }) => {
        try {
          const workSubmissions = await db.getWorkSubmissions(project.id);
          return { projectId: project.id, workSubmissions };
        } catch (error) {
          return { projectId: project.id, workSubmissions: [] };
        }
      });

      const workSubmissionResults = await Promise.all(workSubmissionPromises);
      const workSubmissionsByProject = new Map(
        workSubmissionResults.map(({ projectId, workSubmissions }) => [projectId, workSubmissions])
      );

      // Process proposal counts
      for (const { project, proposals } of proposalResults) {
        try {
          if (project.started_at) {
            // Get work submissions for this project
            const workSubmissions = workSubmissionsByProject.get(project.id) || [];
            const freelancerIdsFromWork = new Set(
              workSubmissions.map(sub => sub.freelancer_id).filter(Boolean)
            );
            
            // Check escrow to find the previously assigned freelancer's wallet
            let freelancerIdsFromEscrow = new Set<string>();
            const escrow = escrowData[project.id];
            if (escrow && escrow.freelancer_wallet) {
              try {
                const freelancerProfile = await db.getProfileByWallet(escrow.freelancer_wallet);
                if (freelancerProfile?.id) {
                  freelancerIdsFromEscrow.add(freelancerProfile.id);
                }
              } catch (escrowError) {
                // Ignore escrow errors
              }
            }
            
            // Combine both strategies
            const previouslyAssignedFreelancerIds = new Set([
              ...Array.from(freelancerIdsFromWork),
              ...Array.from(freelancerIdsFromEscrow)
            ]);
            
            // Filter out only OLD proposals from previously assigned freelancers (created before started_at)
            // Allow NEW proposals from previously assigned freelancers (created after started_at)
            const startedAtDate = new Date(project.started_at);
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
            
            proposalCountData[project.id] = validProposals.length;
          } else {
            // Project never had a freelancer assigned, show all proposals
            proposalCountData[project.id] = proposals.length;
          }
        } catch (error) {
          console.log(`Error processing proposal count for project ${project.id}:`, error);
          proposalCountData[project.id] = 0;
        }
      }
      
      setEscrows(escrowData);
      setProposalCounts(proposalCountData);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Failed to Load Projects",
        description: "Please try refreshing the page",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPostedProjects = postedProjects.filter(project => {
    // Exclude completed projects from "Projects Posted" tab
    if (project.status === 'completed') {
      return false;
    }
    
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const filteredWorkingProjects = workingProjects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Combine completed projects from both posted and working (deduplicate by ID)
  const allProjectsMap = new Map<string, Project>();
  [...postedProjects, ...workingProjects].forEach(p => {
    if (!allProjectsMap.has(p.id)) {
      allProjectsMap.set(p.id, p);
    }
  });
  const completedProjects = Array.from(allProjectsMap.values()).filter(p => p.status === 'completed');
  
  const filteredCompletedProjects = completedProjects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Filter out completed projects for stats (they should only appear in Completed tab)
  const activePostedProjects = postedProjects.filter(p => p.status !== 'completed');
  
  const postedStats = {
    total: activePostedProjects.length,
    active: activePostedProjects.filter(p => p.status === 'active').length,
    inProgress: activePostedProjects.filter(p => p.status === 'in_progress').length,
    completed: 0, // Completed projects are not shown in this tab
    totalEscrowed: Object.entries(escrows)
      .filter(([projectId]) => activePostedProjects.some(p => p.id === projectId))
      .reduce((sum, [_, escrow]) => {
        // Convert SOL to USD if payment currency is SOLANA
        if (escrow.payment_currency === 'SOLANA' && solPrice) {
          return sum + (escrow.total_locked * solPrice);
        }
        // Otherwise, assume it's already in USD
        return sum + escrow.total_locked;
      }, 0)
  };

  const workingStats = {
    total: workingProjects.length,
    inProgress: workingProjects.filter(p => p.status === 'in_progress').length,
    completed: workingProjects.filter(p => p.status === 'completed').length,
    totalEarned: Object.entries(escrows)
      .filter(([projectId]) => workingProjects.some(p => p.id === projectId))
      .filter(([_, escrow]) => escrow.status === 'released')
      .reduce((sum, [_, escrow]) => {
        // Convert SOL to USD if payment currency is SOLANA
        if (escrow.payment_currency === 'SOLANA' && solPrice) {
          return sum + (escrow.amount_usdc * solPrice);
        }
        // Otherwise, assume it's already in USD
        return sum + escrow.amount_usdc;
      }, 0)
  };

  const completedStats = {
    total: completedProjects.length,
    posted: completedProjects.filter(p => postedProjects.some(pp => pp.id === p.id)).length,
    working: completedProjects.filter(p => workingProjects.some(wp => wp.id === p.id)).length,
    totalPaid: Object.entries(escrows)
      .filter(([projectId]) => completedProjects.some(p => p.id === projectId))
      .filter(([_, escrow]) => escrow.status === 'released')
      .reduce((sum, [_, escrow]) => {
        // Convert SOL to USD if payment currency is SOLANA
        if (escrow.payment_currency === 'SOLANA' && solPrice) {
          return sum + (escrow.amount_usdc * solPrice);
        }
        // Otherwise, assume it's already in USD
        return sum + escrow.amount_usdc;
      }, 0)
  };

  const handleViewProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-24">
          <div className="text-center max-w-2xl mx-auto">
            <Wallet className="w-16 h-16 mx-auto mb-6 text-web3-primary" />
            <h1 className="text-3xl font-bold mb-4 text-foreground">
              Connect Your Wallet
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Connect your wallet to view and manage your Web3 projects
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground mb-4 md:mb-0">
              Manage your projects and track your work
            </p>
          </div>
          <Link to="/post-project" className="w-full md:w-auto md:self-center">
            <Button variant="default" size="lg" className="w-full md:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              Post New Project
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="posted" className="space-y-6">
          <div className="w-full overflow-x-auto scrollbar-hide">
            <TabsList className="inline-flex w-full sm:w-auto min-w-full sm:min-w-0 gap-1 sm:gap-2">
              <TabsTrigger value="posted" className="flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-4 py-2 flex-1 sm:flex-initial whitespace-nowrap">
                <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Projects Posted</span>
                <span className="sm:hidden">Posted</span>
                <span className="ml-0.5">({activePostedProjects.length})</span>
              </TabsTrigger>
              <TabsTrigger value="working" className="flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-4 py-2 flex-1 sm:flex-initial whitespace-nowrap">
                <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Working On</span>
                <span className="sm:hidden">Working</span>
                <span className="ml-0.5">({workingProjects.length})</span>
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs md:text-sm px-2 sm:px-4 py-2 flex-1 sm:flex-initial whitespace-nowrap">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Completed</span>
                <span className="ml-0.5">({completedProjects.length})</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Projects Posted Tab */}
          <TabsContent value="posted" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-foreground">{postedStats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Projects</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-green">{postedStats.active}</div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-amber">{postedStats.inProgress}</div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-primary">{postedStats.completed}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-primary">
                    {formatUSDC(postedStats.totalEscrowed)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Escrowed</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {PROJECT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Projects Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Loading projects...</div>
              </div>
            ) : filteredPostedProjects.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <div className="text-muted-foreground mb-4">
                  {activePostedProjects.length === 0 ? 'No projects posted yet' : 'No projects match your filters'}
                </div>
                {activePostedProjects.length === 0 && (
                  <Link to="/post-project">
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      Post Your First Project
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPostedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    escrow={escrows[project.id]}
                    proposalCount={proposalCounts[project.id]}
                    onViewProject={handleViewProject}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Working On Tab */}
          <TabsContent value="working" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-foreground">{workingStats.total}</div>
                  <div className="text-sm text-muted-foreground">Active Projects</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-amber">{workingStats.inProgress}</div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-green">{workingStats.completed}</div>
                  <div className="text-sm text-muted-foreground">Completed</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-green">
                    {formatUSDC(workingStats.totalEarned)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Earned</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Projects Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Loading projects...</div>
              </div>
            ) : filteredWorkingProjects.length === 0 ? (
              <div className="text-center py-12">
                <Wrench className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <div className="text-muted-foreground mb-4">
                  {workingProjects.length === 0 ? 'No active projects' : 'No projects match your filters'}
                </div>
                {workingProjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Browse available projects and submit proposals to start working
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredWorkingProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    escrow={escrows[project.id]}
                    onViewProject={handleViewProject}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Completed Projects Tab */}
          <TabsContent value="completed" className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-foreground">{completedStats.total}</div>
                  <div className="text-sm text-muted-foreground">Total Completed</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-primary">{completedStats.posted}</div>
                  <div className="text-sm text-muted-foreground">Posted Projects</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-green">{completedStats.working}</div>
                  <div className="text-sm text-muted-foreground">Working Projects</div>
                </CardContent>
              </Card>
              <Card className="border-primary/20 bg-card">
                <CardContent className="p-6">
                  <div className="text-2xl font-bold text-accent-green">
                    {formatUSDC(completedStats.totalPaid)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Paid</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {PROJECT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Projects Grid */}
            {loading ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground">Loading projects...</div>
              </div>
            ) : filteredCompletedProjects.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <div className="text-muted-foreground mb-4">
                  {completedProjects.length === 0 ? 'No completed projects yet' : 'No completed projects match your filters'}
                </div>
                {completedProjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Completed projects will appear here once you finish your work
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCompletedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    escrow={escrows[project.id]}
                    proposalCount={proposalCounts[project.id]}
                    onViewProject={handleViewProject}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDashboard;