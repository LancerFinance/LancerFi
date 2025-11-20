import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Link as LinkIcon, Loader2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { useRateLimit } from "@/hooks/useRateLimit";
import { db, supabase } from "@/lib/supabase";
import { scanFiles, ScanResult } from "@/lib/file-security-scanner";

interface SubmitWorkDialogProps {
  projectId: string;
  freelancerId: string;
  projectTitle: string;
  onSubmissionComplete?: () => void;
  triggerVariant?: "outline" | "default" | "ghost";
  triggerSize?: "sm" | "default" | "lg";
  triggerClassName?: string;
  disabled?: boolean;
}

const SubmitWorkDialog = ({ 
  projectId,
  freelancerId,
  projectTitle,
  onSubmissionComplete,
  triggerVariant = "default",
  triggerSize = "sm",
  triggerClassName = "w-full",
  disabled = false
}: SubmitWorkDialogProps) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    linkUrl: ''
  });
  const [files, setFiles] = useState<File[]>([]);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [linkUrls, setLinkUrls] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { address, isConnected } = useWallet();
  const { canProceed } = useRateLimit({ minTimeBetweenCalls: 2000, actionName: 'submitting work' });

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles = Array.from(selectedFiles);
    const validFiles = newFiles.filter(file => {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB. Please select a smaller file.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addLink = () => {
    const link = formData.linkUrl.trim();
    if (!link) {
      setErrors(prev => ({ ...prev, linkUrl: 'Please enter a valid URL' }));
      return;
    }

    // Basic URL validation
    try {
      new URL(link);
      setLinkUrls(prev => [...prev, link]);
      setFormData(prev => ({ ...prev, linkUrl: '' }));
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.linkUrl;
        return newErrors;
      });
    } catch {
      setErrors(prev => ({ ...prev, linkUrl: 'Please enter a valid URL (e.g., https://example.com)' }));
    }
  };

  const removeLink = (index: number) => {
    setLinkUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (files.length === 0) return [];

    setUploadingFiles(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${projectId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('work-submissions')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          
          // Provide specific error messages for storage issues
          if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('does not exist')) {
            throw new Error(`Storage bucket not found. Please ensure the 'work-submissions' storage bucket has been created.`);
          } else if (uploadError.message.includes('permission denied') || uploadError.message.includes('new row violates row-level security')) {
            throw new Error(`Permission denied for file upload. Please check storage bucket permissions.`);
          } else {
            throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
          }
        }

        const { data: { publicUrl } } = supabase.storage
          .from('work-submissions')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmit = async () => {
    // Rate limiting check
    if (!canProceed()) {
      return;
    }

    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to submit work",
        variant: "destructive",
      });
      return;
    }

    // Validate form
    const newErrors: Record<string, string> = {};
    if (!formData.description.trim()) {
      newErrors.description = 'Please provide a description of your work';
    }
    if (files.length === 0 && linkUrls.length === 0) {
      newErrors.files = 'Please add at least one file or link';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      // Scan files for suspicious content BEFORE uploading
      let scanResult: ScanResult = { hasSuspiciousFiles: false, suspiciousFiles: [] };
      if (files.length > 0) {
        scanResult = await scanFiles(files);
      }

      // Upload files if any
      const uploadedFileUrls = await uploadFiles();

      // Create work submission with suspicious files info
      const submission = await db.createWorkSubmission({
        project_id: projectId,
        freelancer_id: freelancerId,
        description: formData.description.trim(),
        file_urls: uploadedFileUrls,
        link_urls: linkUrls,
        status: 'pending',
        has_suspicious_files: scanResult.hasSuspiciousFiles,
        suspicious_files_details: scanResult.suspiciousFiles
      });

      // Get project details for notification
      const project = await db.getProject(projectId);
      if (project && submission) {
        // For X402 projects, capture freelancer's EVM address when they submit work
        if (project.payment_currency === 'X402') {
          try {
            const escrow = await db.getEscrow(projectId);
            if (escrow && (!escrow.freelancer_wallet || !escrow.freelancer_wallet.startsWith('0x'))) {
              // Get freelancer's EVM address from their connected wallet
              const w: any = window as any;
              let ethereumProvider = w.ethereum;
              const ph = w.solana;
              if (ph?.isPhantom && (ph as any).ethereum) {
                ethereumProvider = (ph as any).ethereum;
              } else if (!ethereumProvider && ph?.ethereum) {
                ethereumProvider = ph.ethereum;
              }
              
              if (ethereumProvider) {
                const { ethers } = await import('ethers');
                const provider = new ethers.BrowserProvider(ethereumProvider);
                const signer = await provider.getSigner();
                const evmAddress = await signer.getAddress();
                
                // Store EVM address in escrow
                await db.updateEscrow(escrow.id, { freelancer_wallet: evmAddress });
              }
            }
          } catch (evmError) {
            // Silently fail - freelancer might not have EVM wallet connected
            console.log('Could not capture freelancer EVM address:', evmError);
          }
        }
        
        // Send notification to client
        await db.sendWorkSubmissionNotification(
          projectId,
          projectTitle,
          project.client_id,
          address,
          submission.id,
          true
        );
      }

      // Show success toast
      toast({
        title: "Work Submitted!",
        description: "Your work has been submitted for review. The client will be notified.",
      });

      // Show warning toast if suspicious files detected
      if (scanResult.hasSuspiciousFiles) {
        const highSeverityCount = scanResult.suspiciousFiles.filter(f => f.severity === 'high').length;
        toast({
          title: "⚠️ Security Warning",
          description: `Suspicious files detected in your submission (${scanResult.suspiciousFiles.length} file${scanResult.suspiciousFiles.length > 1 ? 's' : ''}). The client has been notified. Please ensure all files are legitimate.`,
          variant: "destructive",
        });
      }

      // Reset form and close dialog
      setFormData({ description: '', linkUrl: '' });
      setFiles([]);
      setFileUrls([]);
      setLinkUrls([]);
      setOpen(false);

      // Callback to refresh data
      if (onSubmissionComplete) {
        onSubmissionComplete();
      }
    } catch (error: any) {
      console.error('Error submitting work:', error);
      
      // Provide more specific error messages
      let errorMessage = "Please try again later";
      
      if (error?.message) {
        errorMessage = error.message;
        
        // Check for common database errors
        if (error.message.includes('relation "work_submissions" does not exist')) {
          errorMessage = "Database table not found. Please ensure migrations have been run.";
        } else if (error.message.includes('permission denied') || error.message.includes('new row violates row-level security')) {
          errorMessage = "Permission denied. Please ensure you are the assigned freelancer for this project.";
        } else if (error.message.includes('violates foreign key constraint')) {
          errorMessage = "Invalid project or freelancer reference. Please refresh the page and try again.";
        } else if (error.code === 'PGRST116') {
          errorMessage = "Table not found. Please ensure database migrations have been run.";
        } else if (error.code === '42501') {
          errorMessage = "Permission denied. Please ensure you are the assigned freelancer for this project.";
        }
      }
      
      toast({
        title: "Failed to Submit Work",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={triggerVariant} 
          size={triggerSize} 
          className={triggerClassName}
          disabled={!isConnected || disabled}
        >
          <Upload className="w-4 h-4 mr-2" />
          Submit Work
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Work for {projectTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Work Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe the work you've completed, what was delivered, and any important notes..."
              value={formData.description}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, description: e.target.value }));
                setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.description;
                  return newErrors;
                });
              }}
              rows={6}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Files (Optional)</Label>
            <div 
              className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border'
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select Files
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Drag and drop files here or click to select (max 10MB per file)
                </p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.files && (
              <p className="text-sm text-destructive">{errors.files}</p>
            )}
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Label htmlFor="linkUrl">Links (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="linkUrl"
                type="url"
                placeholder="https://example.com"
                value={formData.linkUrl}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, linkUrl: e.target.value }));
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.linkUrl;
                    return newErrors;
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addLink();
                  }
                }}
                className={errors.linkUrl ? 'border-destructive' : ''}
              />
              <Button type="button" variant="outline" onClick={addLink}>
                <LinkIcon className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            </div>
            {errors.linkUrl && (
              <p className="text-sm text-destructive">{errors.linkUrl}</p>
            )}
            {linkUrls.length > 0 && (
              <div className="space-y-2">
                {linkUrls.map((link, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline truncate flex-1"
                    >
                      {link}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLink(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting || uploadingFiles}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || uploadingFiles}
            >
              {(submitting || uploadingFiles) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadingFiles ? 'Uploading...' : 'Submitting...'}
                </>
              ) : (
                'Submit Work'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubmitWorkDialog;

