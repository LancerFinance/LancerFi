import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Shield, User, CheckCircle } from "lucide-react";
import { Project, Escrow } from "@/lib/supabase";
import { formatUSDC } from "@/lib/solana";

interface ProjectCardProps {
  project: Project;
  escrow?: Escrow;
  onViewProject: (id: string) => void;
  proposalCount?: number;
}

const ProjectCard = ({ project, escrow, onViewProject, proposalCount = 0 }: ProjectCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-web3-success/10 text-web3-success';
      case 'in_progress': return 'bg-web3-warning/10 text-web3-warning';
      case 'completed': return 'bg-web3-primary/10 text-web3-primary';
      case 'disputed': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted/10 text-muted-foreground';
    }
  };

  const getEscrowStatusIcon = (status?: string) => {
    switch (status) {
      case 'funded': return <Shield className="w-4 h-4 text-web3-success" />;
      case 'released': return <CheckCircle className="w-4 h-4 text-web3-primary" />;
      case 'pending': return <Clock className="w-4 h-4 text-web3-warning" />;
      default: return <Shield className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Card className="bg-gradient-card border border-border/50 hover:shadow-corporate transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl text-foreground line-clamp-2">
              {project.title}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge className={getStatusColor(project.status)}>
                {project.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {project.category}
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            {getEscrowStatusIcon(escrow?.status)}
            <span className="capitalize">{escrow?.status || 'No Escrow'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm line-clamp-3">
          {project.description}
        </p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4 text-web3-primary" />
            <span className="text-foreground font-medium">
              {formatUSDC(project.budget_usdc)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-web3-secondary" />
            <span className="text-muted-foreground">
              {project.timeline}
            </span>
          </div>
        </div>

        {project.freelancer && (
          <div className="flex items-center space-x-2 text-sm">
            <User className="w-4 h-4 text-web3-success" />
            <span className="text-foreground">
              Assigned to {project.freelancer.username || project.freelancer.full_name || 'Freelancer'}
            </span>
          </div>
        )}

        {escrow && (
          <div className="bg-web3-primary/5 rounded-lg p-3 border border-web3-primary/20">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Escrow Locked:</span>
              <span className="text-web3-primary font-medium">
                {formatUSDC(escrow.total_locked)}
              </span>
            </div>
            {escrow.escrow_account && (
              <div className="mt-1 text-xs text-muted-foreground">
                Contract: {escrow.escrow_account.slice(0, 8)}...{escrow.escrow_account.slice(-6)}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {project.required_skills.slice(0, 3).map((skill, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
          {project.required_skills.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{project.required_skills.length - 3} more
            </Badge>
          )}
        </div>

        {/* Proposal notification */}
        {!project.freelancer_id && proposalCount > 0 && (
          <div className="bg-accent-amber/10 border border-accent-amber/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-accent-amber">
                {proposalCount} New Proposal{proposalCount > 1 ? 's' : ''}
              </span>
              <Badge className="bg-accent-amber text-white">
                {proposalCount}
              </Badge>
            </div>
          </div>
        )}

        <Button
          variant="outline" 
          className="w-full"
          onClick={() => onViewProject(project.id)}
        >
          View Project Details
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProjectCard;