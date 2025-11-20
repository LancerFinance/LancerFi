import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { Search, Edit, Briefcase, EyeOff, Trash2 } from "lucide-react";
import { db, Project } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const AdminProjects = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await db.getAllProjects();
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = searchTerm === '' || 
      project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'active': 'default',
      'in_progress': 'default',
      'completed': 'secondary',
      'cancelled': 'destructive',
      'disputed': 'destructive',
      'draft': 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm(`Are you sure you want to DELETE this project? This action cannot be undone and will delete all associated escrows, proposals, and milestones.`)) {
      return;
    }
    
    try {
      const result = await db.deleteProject(projectId);
      if (result?.success) {
        toast({
          title: "Success",
          description: "Project deleted successfully",
        });
        setProjects((prev) => prev.filter((project) => project.id !== projectId));
        await loadProjects();
      } else {
        throw new Error("Delete operation returned no success confirmation");
      }
    } catch (error: any) {
      console.error('Delete project error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete project. Please check console for details.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Projects</h2>
        <p className="text-sm text-muted-foreground mt-1">Total: {projects.length} projects</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No projects found</p>
            </CardContent>
          </Card>
        ) : (
          filteredProjects.map((project) => (
            <Card key={project.id} className="hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-base sm:text-lg truncate">{project.title}</h3>
                      {getStatusBadge(project.status)}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Category: {project.category}</span>
                      <span>•</span>
                      <span>Client: {project.client_id.slice(0, 8)}...{project.client_id.slice(-6)}</span>
                      {project.freelancer_id && (
                        <>
                          <span>•</span>
                          <span>Freelancer: {project.freelancer_id.slice(0, 8)}...{project.freelancer_id.slice(-6)}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Budget: ${project.budget_usdc} USDC</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created: {format(new Date(project.created_at), 'PPp')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/project/${project.id}/edit`)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (confirm(`Are you sure you want to ${project.is_hidden ? 'unhide' : 'hide'} this project?`)) {
                          try {
                            if (project.is_hidden) {
                              await db.unhideProject(project.id);
                              toast({
                                title: "Success",
                                description: "Project unhidden successfully",
                              });
                            } else {
                              await db.hideProject(project.id);
                              toast({
                                title: "Success",
                                description: "Project hidden successfully",
                              });
                            }
                            loadProjects();
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message || "Failed to update project",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                    >
                      <EyeOff className="w-4 h-4 mr-2" />
                      {project.is_hidden ? 'Unhide' : 'Hide'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminProjects;

