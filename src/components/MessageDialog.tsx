import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2, Paperclip, X, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { db, supabase } from "@/lib/supabase";
import { validateMessage } from "@/lib/validation";
import { validateImageFile, validateDocumentFile } from "@/lib/file-security";
import { checkImageForNSFW } from "@/lib/nsfw-detection";

interface MessageDialogProps {
  recipientId: string;
  recipientName: string;
  projectTitle?: string;
  triggerVariant?: "outline" | "default" | "ghost";
  triggerSize?: "sm" | "default" | "lg";
  triggerClassName?: string;
  triggerText?: string;
  triggerIcon?: React.ReactNode;
  requireSubject?: boolean;
  onMessageSent?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MessageDialog = ({ 
  recipientId, 
  recipientName, 
  projectTitle,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName = "w-full",
  triggerText,
  triggerIcon,
  requireSubject = false,
  onMessageSent,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: MessageDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    subject: projectTitle ? `Re: ${projectTitle}` : '',
    content: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Array<{ file: File; preview?: string; url?: string; name: string }>>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { toast } = useToast();
  const { address, isConnected } = useWallet();

  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: File[] = Array.from(files);
    
    // Check total count limit
    if (attachments.length + newFiles.length > 3) {
      toast({
        title: "Too many files",
        description: "You can only attach up to 3 files or images.",
        variant: "destructive",
      });
      return;
    }

    // Process each file
    for (const file of newFiles) {
      // Validate file size (10MB max for messages)
      const MAX_MESSAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_MESSAGE_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `File size exceeds 10MB limit. Please choose a smaller file.`,
          variant: "destructive",
        });
        continue;
      }

      // Validate file
      let validation;
      if (isImageFile(file)) {
        validation = validateImageFile(file);
      } else {
        validation = validateDocumentFile(file);
      }

      if (!validation.isValid) {
        toast({
          title: "Invalid file",
          description: validation.error || "File validation failed",
          variant: "destructive",
        });
        continue;
      }

      // Check image for NSFW content
      if (isImageFile(file)) {
        try {
          toast({
            title: "Checking image...",
            description: "Verifying image content",
          });

          const nsfwCheck = await checkImageForNSFW(file, 0.75);
          
          if (nsfwCheck.isNSFW) {
            toast({
              title: "Image Not Allowed",
              description: `This image contains inappropriate content (${nsfwCheck.category}, ${Math.round(nsfwCheck.confidence * 100)}% confidence). Please upload a different image.`,
              variant: "destructive",
            });
            continue;
          }
        } catch (error) {
          toast({
            title: "Image check failed",
            description: "Could not verify image content. Please try again.",
            variant: "destructive",
          });
          continue;
        }
      }

      // Create preview for images
      let preview: string | undefined;
      if (isImageFile(file)) {
        preview = URL.createObjectURL(file);
      }

      setAttachments(prev => [...prev, { file, preview, name: file.name }]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const removed = prev[index];
      if (removed.preview) {
        URL.revokeObjectURL(removed.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const uploadAttachments = async (): Promise<string[]> => {
    if (attachments.length === 0) return [];

    setUploadingAttachments(true);
    const uploadedUrls: string[] = [];

    try {
      for (const attachment of attachments) {
        const fileExt = attachment.file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = fileName;

        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, attachment.file);

        if (uploadError) {
          throw new Error(`Failed to upload ${attachment.file.name}: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(filePath);

        uploadedUrls.push(publicUrl);
      }

      return uploadedUrls;
    } catch (error: any) {
      throw error;
    } finally {
      setUploadingAttachments(false);
    }
  };

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to send messages",
        variant: "destructive",
      });
      return;
    }

    // Check if user is muted or banned
    try {
      const restriction = await db.checkUserRestriction(address);
      if (restriction.isRestricted) {
        const restrictionType = restriction.restrictionType;
        if (restrictionType === 'mute' || restrictionType === 'ban_wallet') {
          const restrictionName = restrictionType === 'mute' ? 'muted' : 'banned';
          const expiresAt = restriction.expiresAt 
            ? new Date(restriction.expiresAt).toLocaleString()
            : 'permanently';
          toast({
            title: "Cannot Send Message",
            description: `You are ${restrictionName} ${expiresAt !== 'permanently' ? `until ${expiresAt}` : 'permanently'}. You cannot send messages.${restriction.reason ? ` Reason: ${restriction.reason}` : ''}`,
            variant: "destructive",
          });
          return;
        }
      }
    } catch (error) {
      // Continue if check fails
    }

    // Validate form
    if (requireSubject && !formData.subject.trim()) {
      setErrors({ subject: 'Subject is required' });
      return;
    }

    const validationErrors = validateMessage(formData.content, formData.subject, requireSubject);
    if (validationErrors.length > 0) {
      const errorMap: Record<string, string> = {};
      validationErrors.forEach(error => {
        errorMap[error.field] = error.message;
      });
      setErrors(errorMap);
      return;
    }

    setSending(true);
    setErrors({});

    try {
      // Upload attachments first
      const attachmentUrls = await uploadAttachments();

      // For support messages, use backend endpoint that enforces rate limiting
      if (recipientId === 'admin@lancerfi.app') {
        const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';
        const response = await fetch(`${API_BASE_URL}/api/messages/create-support-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            walletAddress: address,
            subject: formData.subject.trim() || undefined,
            content: formData.content.trim(),
            attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 429) {
            // Rate limit exceeded
            toast({
              title: "Rate Limit Exceeded",
              description: errorData.error || "You've sent too many support messages. Please wait before sending another.",
              variant: "destructive",
            });
            setSending(false);
            return;
          }
          throw new Error(errorData.error || 'Failed to send message');
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to send message');
        }
      } else {
        // For non-support messages, use direct Supabase
        await db.createMessage({
          sender_id: address,
          recipient_id: recipientId,
          subject: formData.subject.trim() || undefined,
          content: formData.content.trim(),
          attachments: attachmentUrls.length > 0 ? attachmentUrls : undefined
        });
      }

      toast({
        title: "Message Sent!",
        description: `Your message has been sent to ${recipientName}`,
      });

      // Reset form and close dialog
      setFormData({ subject: '', content: '' });
      // Clean up attachment previews
      attachments.forEach(att => {
        if (att.preview) {
          URL.revokeObjectURL(att.preview);
        }
      });
      setAttachments([]);
      setOpen(false);
      
      // Call callback if provided
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      toast({
        title: "Failed to Send Message",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Auto-open if trigger is hidden (for programmatic opening)
  useEffect(() => {
    if (triggerClassName === "hidden" && controlledOpen === undefined) {
      setInternalOpen(true);
    }
  }, [triggerClassName, controlledOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerClassName !== "hidden" && (
        <DialogTrigger asChild>
          <Button 
            variant={triggerVariant} 
            size={triggerSize} 
            className={triggerClassName}
            disabled={!isConnected}
          >
            {triggerIcon || <MessageSquare className="w-4 h-4 mr-2" />}
            {triggerText || "Send Message"}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">
            Send Message to{' '}
            <span className="font-normal text-muted-foreground">
              {recipientName.length > 30 
                ? `${recipientName.slice(0, 30)}...` 
                : recipientName}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject {requireSubject ? '*' : '(Optional)'}</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Message subject"
              className={`${errors.subject ? "border-destructive" : ""} min-w-0`}
              maxLength={200}
              title={formData.subject}
              required={requireSubject}
            />
            {errors.subject && (
              <p className="text-sm text-destructive mt-1">{errors.subject}</p>
            )}
          </div>
          
          <div>
            <Label htmlFor="content">Message *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Type your message here..."
              rows={4}
              className={errors.content ? "border-destructive" : ""}
            />
            {errors.content && (
              <p className="text-sm text-destructive mt-1">{errors.content}</p>
            )}
          </div>

          {/* Attachments Section */}
          <div>
            <Label>Attachments</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
                disabled={attachments.length >= 3}
              >
                <Paperclip className="w-4 h-4 mr-2" />
                {attachments.length >= 3 ? 'Maximum 3 attachments' : 'Attach Files or Images'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Drag and drop files here or click to browse (Max 3 files, 10MB each)
              </p>
            </div>

            {/* Display Attachments */}
            {attachments.length > 0 && (
              <div className="mt-4 space-y-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30"
                  >
                    {attachment.preview ? (
                      <img
                        src={attachment.preview}
                        alt={attachment.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center bg-muted rounded">
                        <Paperclip className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(attachment.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={sending || uploadingAttachments || !formData.content.trim() || (requireSubject && !formData.subject.trim())}
              className="flex-1"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageSquare className="w-4 h-4 mr-2" />
              )}
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MessageDialog;