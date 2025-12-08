import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Shield, User, CheckCircle, Bookmark, BookmarkCheck } from "lucide-react";
import { Project, Escrow, db } from "@/lib/supabase";
import { formatUSDC, formatSOL } from "@/lib/solana";
import { useState, useEffect } from "react";
import { getSolanaPrice } from "@/lib/solana-price";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";

interface ProjectCardProps {
  project: Project;
  escrow?: Escrow;
  onViewProject: (id: string) => void;
  proposalCount?: number;
}

const ProjectCard = ({ project, escrow, onViewProject, proposalCount = 0 }: ProjectCardProps) => {
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const { address, isConnected } = useWallet();
  const { toast } = useToast();

  useEffect(() => {
    if (escrow?.payment_currency === 'SOLANA') {
      getSolanaPrice().then(priceData => {
        setSolPrice(priceData.price_usd);
      }).catch(() => {
        // Fallback price
        setSolPrice(100);
      });
    }
  }, [escrow?.payment_currency]);

  useEffect(() => {
    if (isConnected && address) {
      checkBookmarkStatus();
    } else {
      // Reset bookmark status when wallet disconnects
      setIsBookmarked(false);
    }
  }, [isConnected, address, project.id]);

  const checkBookmarkStatus = async () => {
    if (!address) return;
    try {
      const bookmarked = await db.isBookmarked(address, project.id);
      setIsBookmarked(bookmarked);
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    }
  };

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConnected || !address) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to bookmark projects",
        variant: "destructive"
      });
      return;
    }

    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        await db.removeBookmark(address, project.id);
        setIsBookmarked(false);
        toast({
          title: "Bookmark Removed",
          description: "Project removed from your bookmarks",
        });
      } else {
        await db.addBookmark(address, project.id);
        setIsBookmarked(true);
        toast({
          title: "Bookmark Added",
          description: "Project added to your bookmarks",
        });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to update bookmark. Please try again.",
        variant: "destructive"
      });
    } finally {
      setBookmarkLoading(false);
    }
  };

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
    <Card className="bg-gradient-card border border-border/50 hover:shadow-corporate transition-all duration-300 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-xl text-foreground line-clamp-2 break-words flex-1">
                {project.title}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleBookmarkToggle}
                disabled={bookmarkLoading}
                title={isBookmarked ? "Remove bookmark" : "Bookmark project"}
              >
                {isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-web3-primary fill-web3-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              <Badge className={getStatusColor(project.status)}>
                {project.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {project.category}
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-1 text-sm text-muted-foreground flex-shrink-0">
            {getEscrowStatusIcon(escrow?.status)}
            <span className="capitalize whitespace-nowrap">{escrow?.status || 'No Escrow'}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm line-clamp-3 break-words">
          {project.description}
        </p>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2 min-w-0">
            <DollarSign className="w-4 h-4 text-web3-primary flex-shrink-0" />
            <span className="text-foreground font-medium truncate">
              {formatUSDC(project.budget_usdc)}
            </span>
          </div>
          <div className="flex items-center space-x-2 min-w-0">
            <Clock className="w-4 h-4 text-web3-secondary flex-shrink-0" />
            <span className="text-muted-foreground truncate">
              {project.timeline}
            </span>
          </div>
        </div>

        {project.freelancer && (
          <div className="flex items-center space-x-2 text-sm min-w-0">
            <User className="w-4 h-4 text-web3-success flex-shrink-0" />
            <span className="text-foreground truncate">
              Assigned to {project.freelancer.username || project.freelancer.full_name || 'Freelancer'}
            </span>
          </div>
        )}

        {escrow && (
          <div className="bg-web3-primary/5 rounded-lg p-3 border border-web3-primary/20">
            <div className="flex items-center justify-between text-sm gap-2 min-w-0">
              <span className="text-muted-foreground flex-shrink-0">Escrow Locked:</span>
              <span className="text-web3-primary font-medium truncate text-right">
                {escrow.payment_currency === 'SOLANA'
                  ? formatSOL(escrow.total_locked)
                  : formatUSDC(escrow.total_locked)
                }
                {escrow.payment_currency === 'SOLANA' && solPrice && (
                  <span className="text-xs text-muted-foreground ml-1 whitespace-nowrap">
                    (~{formatUSDC(escrow.total_locked * solPrice)})
                  </span>
                )}
              </span>
            </div>
            {escrow.escrow_account && (
              <div className="mt-1 text-xs text-muted-foreground truncate">
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
                There {proposalCount === 1 ? 'is a' : 'are'} Freelancer{proposalCount > 1 ? 's' : ''} Interested in the Project
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