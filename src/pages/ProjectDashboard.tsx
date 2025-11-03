import { useState, useEffect } from 'react';
import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Filter, Search, Wallet, Briefcase, Wrench, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { db, Project, Escrow } from "@/lib/supabase";
import { formatUSDC } from "@/lib/solana";
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

  useEffect(() => {
    if (address) {
      loadProjects();
    }
  }, [address]);

  const loadProjects = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      
      // Get user profile to find their profile ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('wallet_address', address)
        .maybeSingle();

      // Load projects POSTED by me (as client)
      const { data: clientProjects, error: clientError } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', address)
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

      // Load escrows and proposal counts for all projects
      const allProjects = [...(clientProjects || []), ...freelancerProjects];
      const escrowData: Record<string, Escrow> = {};
      const proposalCountData: Record<string, number> = {};
      
      for (const project of allProjects) {
        try {
          const escrow = await db.getEscrow(project.id);
          if (escrow) {
            escrowData[project.id] = escrow;
          }
        } catch (error) {
          // Escrow doesn't exist for this project
        }

        // Load proposal count for projects without freelancers (only for posted projects)
        if (!project.freelancer_id && project.client_id === address) {
          try {
            const { data: proposals, error } = await supabase
              .from('proposals')
              .select('id', { count: 'exact' })
              .eq('project_id', project.id);
            
            if (!error && proposals) {
              proposalCountData[project.id] = proposals.length;
            }
          } catch (error) {
            console.log('Error loading proposal count:', error);
          }
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

  const postedStats = {
    total: postedProjects.length,
    active: postedProjects.filter(p => p.status === 'active').length,
    inProgress: postedProjects.filter(p => p.status === 'in_progress').length,
    completed: postedProjects.filter(p => p.status === 'completed').length,
    totalEscrowed: Object.entries(escrows)
      .filter(([projectId]) => postedProjects.some(p => p.id === projectId))
      .reduce((sum, [_, escrow]) => sum + escrow.total_locked, 0)
  };

  const workingStats = {
    total: workingProjects.length,
    inProgress: workingProjects.filter(p => p.status === 'in_progress').length,
    completed: workingProjects.filter(p => p.status === 'completed').length,
    totalEarned: Object.entries(escrows)
      .filter(([projectId]) => workingProjects.some(p => p.id === projectId))
      .filter(([_, escrow]) => escrow.status === 'released')
      .reduce((sum, [_, escrow]) => sum + escrow.amount_usdc, 0)
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
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage your projects and track your work
            </p>
          </div>
          <Link to="/post-project" className="md:self-center">
            <Button variant="default" size="lg" className="w-full md:w-auto">
              <Plus className="w-5 h-5 mr-2" />
              Post New Project
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="posted" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="posted" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Projects Posted ({postedProjects.length})
            </TabsTrigger>
            <TabsTrigger value="working" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Working On ({workingProjects.length})
            </TabsTrigger>
          </TabsList>

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
                  {postedProjects.length === 0 ? 'No projects posted yet' : 'No projects match your filters'}
                </div>
                {postedProjects.length === 0 && (
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
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectDashboard;