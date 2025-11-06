import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  ExternalLink, 
  FileText, 
  Loader2,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { db, WorkSubmission } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WorkSubmissionReviewProps {
  submission: WorkSubmission;
  projectId: string;
  projectTitle: string;
  clientWallet: string;
  freelancerWallet: string;
  onReviewComplete?: () => void;
}

const WorkSubmissionReview = ({
  submission,
  projectId,
  projectTitle,
  clientWallet,
  freelancerWallet,
  onReviewComplete
}: WorkSubmissionReviewProps) => {
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision' | null>(null);

  const { toast } = useToast();
  const { address, isConnected } = useWallet();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending Review</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      case 'revision_requested':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Revision Requested</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleReview = async (status: 'approved' | 'rejected' | 'revision_requested') => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to review work",
        variant: "destructive",
      });
      return;
    }

    if (address !== clientWallet) {
      toast({
        title: "Unauthorized",
        description: "Only the project owner can review work submissions",
        variant: "destructive",
      });
      return;
    }

    setReviewing(true);

    try {
      await db.updateWorkSubmission(submission.id, {
        status,
        reviewed_by: address,
        review_notes: reviewNotes.trim() || undefined
      });

      // Send notification to freelancer
      await db.sendWorkSubmissionNotification(
        projectId,
        projectTitle,
        clientWallet,
        freelancerWallet,
        submission.id,
        false,
        status,
        reviewNotes.trim() || undefined
      );

      toast({
        title: status === 'approved' ? 'Work Approved!' : status === 'rejected' ? 'Work Rejected' : 'Revision Requested',
        description: status === 'approved' 
          ? 'The work has been approved. You can now complete the project.'
          : status === 'rejected'
          ? 'The work has been rejected. The freelancer has been notified.'
          : 'Revision has been requested. The freelancer has been notified.',
      });

      setReviewNotes('');
      setShowApproveDialog(false);
      setShowRejectDialog(false);
      setShowRevisionDialog(false);
      setActionType(null);

      if (onReviewComplete) {
        onReviewComplete();
      }
    } catch (error) {
      console.error('Error reviewing work:', error);
      toast({
        title: "Review Failed",
        description: error instanceof Error ? error.message : "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReviewing(false);
    }
  };

  const openReviewDialog = (type: 'approve' | 'reject' | 'revision') => {
    setActionType(type);
    if (type === 'approve') {
      setShowApproveDialog(true);
    } else if (type === 'reject') {
      setShowRejectDialog(true);
    } else {
      setShowRevisionDialog(true);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Work Submission</CardTitle>
            {getStatusBadge(submission.status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Calendar className="w-4 h-4" />
            <span>Submitted {new Date(submission.submitted_at).toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Description */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Description</Label>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.description}</p>
          </div>

          {/* Files */}
          {submission.file_urls && submission.file_urls.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Files</Label>
              <div className="space-y-2">
                {submission.file_urls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex-1 truncate"
                    >
                      {url.split('/').pop() || `File ${index + 1}`}
                    </a>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          {submission.link_urls && submission.link_urls.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Links</Label>
              <div className="space-y-2">
                {submission.link_urls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex-1 truncate"
                    >
                      {url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Notes (if reviewed) */}
          {submission.review_notes && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Review Notes</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.review_notes}</p>
            </div>
          )}

          {/* Action Buttons (only show if pending and user is client) */}
          {submission.status === 'pending' && isConnected && address === clientWallet && (
            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add any feedback or notes for the freelancer..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openReviewDialog('approve')}
                  disabled={reviewing}
                  className="flex-1 sm:flex-initial"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openReviewDialog('revision')}
                  disabled={reviewing}
                  className="flex-1 sm:flex-initial"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Request Revision
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openReviewDialog('reject')}
                  disabled={reviewing}
                  className="flex-1 sm:flex-initial"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Work Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve this work submission? Once approved, you can proceed to complete the project and release payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleReview('approved')}
              disabled={reviewing}
            >
              {reviewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Work Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject this work submission? The freelancer will be notified and can resubmit work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleReview('rejected')}
              disabled={reviewing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {reviewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revision Dialog */}
      <AlertDialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Revision</AlertDialogTitle>
            <AlertDialogDescription>
              Request the freelancer to make revisions to their work. They will be notified with your review notes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reviewing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleReview('revision_requested')}
              disabled={reviewing}
            >
              {reviewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                'Request Revision'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WorkSubmissionReview;

