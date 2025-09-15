import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface MessageDialogProps {
  recipientId: string;
  recipientName: string;
  className?: string;
}

export const MessageDialog = ({ recipientId, recipientName, className }: MessageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const { address, isConnected } = useWallet();
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to send messages",
        variant: "destructive",
      });
      return;
    }

    if (!content.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: address,
          recipient_id: recipientId,
          subject: subject.trim() || `Message from ${address.slice(0, 6)}...${address.slice(-4)}`,
          content: content.trim()
        });

      if (error) throw error;

      toast({
        title: "Message Sent!",
        description: `Your message has been sent to ${recipientName}`,
      });

      // Reset form and close dialog
      setSubject('');
      setContent('');
      setOpen(false);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to Send Message",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isConnected) {
    return (
      <Button variant="outline" size="lg" className={className} disabled>
        <MessageCircle className="w-4 h-4 mr-2" />
        Connect Wallet to Message
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className={className}>
          <MessageCircle className="w-4 h-4 mr-2" />
          Send Message
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send Message to {recipientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject (Optional)</Label>
            <Input
              id="subject"
              placeholder="Project discussion, collaboration opportunity..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Hi! I'm interested in working with you on a Web3 project..."
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={sending || !content.trim()}
              className="flex-1"
            >
              {sending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};