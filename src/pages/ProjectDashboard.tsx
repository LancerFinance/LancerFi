import { useState, useEffect } from 'react';
import Header from "@/components/Header";
import ProjectCard from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Filter, Search, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { db, Project, Escrow } from "@/lib/supabase";
import { formatUSDC } from "@/lib/solana";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const ProjectDashboard = () => {
  const { isConnected, address } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [escrows, setEscrows] = useState<Record<string, Escrow>>({});
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
      // Filter projects by connected wallet address (client_id)
      const { data: projectsData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', address)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProjects(projectsData || []);

      // Load escrows for each project
      const escrowData: Record<string, Escrow> = {};
      for (const project of projectsData || []) {
        try {
          const escrow = await db.getEscrow(project.id);
          if (escrow) {
            escrowData[project.id] = escrow;
          }
        } catch (error) {
          // Escrow doesn't exist for this project
        }
      }
      setEscrows(escrowData);
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

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || project.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    inProgress: projects.filter(p => p.status === 'in_progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalEscrowed: Object.values(escrows).reduce((sum, escrow) => sum + escrow.total_locked, 0)
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Project Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage your Web3 projects with smart contract escrow protection
            </p>
          </div>
          <Link to="/post-project">
            <Button variant="default" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Post New Project
            </Button>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Projects</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-web3-success">{stats.active}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-web3-warning">{stats.inProgress}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-web3-primary">{stats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-web3-primary/30">
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-web3-primary">
                {formatUSDC(stats.totalEscrowed)}
              </div>
              <div className="text-sm text-muted-foreground">Total Escrowed</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
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
              <SelectItem value="smart-contracts">Smart Contracts</SelectItem>
              <SelectItem value="dapp-development">DApp Development</SelectItem>
              <SelectItem value="defi">DeFi Solutions</SelectItem>
              <SelectItem value="nft">NFT Development</SelectItem>
              <SelectItem value="blockchain">Blockchain Development</SelectItem>
              <SelectItem value="web3-frontend">Web3 Frontend</SelectItem>
              <SelectItem value="marketing">Web3 Marketing</SelectItem>
              <SelectItem value="design">UI/UX Design</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              {projects.length === 0 ? 'No projects found' : 'No projects match your filters'}
            </div>
            {projects.length === 0 && (
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
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                escrow={escrows[project.id]}
                onViewProject={handleViewProject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDashboard;