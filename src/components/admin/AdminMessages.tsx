import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, Search, Mail, MailOpen, Reply, Shield, Paperclip } from "lucide-react";
import { db, Message } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Admin wallet address
const ADMIN_WALLET_ADDRESS = 'AbPDgKm3HkHPjLxR2efo4WkUTTTdh2Wo5u7Rw52UXC7U';

interface AdminMessagesProps {
  onSupportCountChange?: (count: number) => void;
}

const AdminMessages = ({ onSupportCountChange }: AdminMessagesProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'admin' | 'support'>('all');
  const [lastSupportCheck, setLastSupportCheck] = useState<number>(Date.now());
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);
  const [replyRecipient, setReplyRecipient] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [newMessageRecipient, setNewMessageRecipient] = useState('');
  const [newMessageSubject, setNewMessageSubject] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await db.getAllMessages();
      setMessages(data || []);
      setLastSupportCheck(Date.now());
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Check for new support messages periodically
    const interval = setInterval(async () => {
      try {
        const data = await db.getAllMessages();
        const supportMessages = (data || []).filter(
          msg => msg.recipient_id === 'admin@lancerfi.app' && !msg.is_read
        );
        
        // Check if there are new unread support messages since last check
        setLastSupportCheck(prevCheck => {
          const newSupportMessages = supportMessages.filter(
            msg => new Date(msg.created_at).getTime() > prevCheck
          );
          
          if (newSupportMessages.length > 0) {
            toast({
              title: "New Support Message",
              description: `You have ${newSupportMessages.length} new support message${newSupportMessages.length > 1 ? 's' : ''}`,
            });
            // Reload messages to update the UI
            setMessages(data || []);
            return Date.now();
          }
          return prevCheck;
        });
      } catch (error) {
        // Silently fail - don't spam errors
      }
    }, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const handleReply = (message: Message) => {
    setReplyRecipient(message.sender_id === 'admin@lancerfi.app' ? message.recipient_id : message.sender_id);
    setReplySubject(message.subject ? `Re: ${message.subject}` : '');
    setReplyContent('');
    setReplyDialogOpen(true);
  };

  const sendReply = async () => {
    if (!replyRecipient || !replyContent.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      await db.createMessage({
        sender_id: 'admin@lancerfi.app',
        recipient_id: replyRecipient,
        subject: replySubject || 'Message from Admin',
        content: replyContent
      });
      toast({
        title: "Success",
        description: "Message sent successfully"
      });
      setReplyDialogOpen(false);
      setReplyRecipient('');
      setReplySubject('');
      setReplyContent('');
      loadMessages();
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const sendNewMessage = async () => {
    if (!newMessageRecipient || !newMessageContent.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    try {
      await db.createMessage({
        sender_id: 'admin@lancerfi.app',
        recipient_id: newMessageRecipient,
        subject: newMessageSubject || 'Message from Admin',
        content: newMessageContent
      });
      toast({
        title: "Success",
        description: "Message sent successfully"
      });
      setNewMessageDialogOpen(false);
      setNewMessageRecipient('');
      setNewMessageSubject('');
      setNewMessageContent('');
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const supportMessages = messages.filter(
    msg => msg.recipient_id === 'admin@lancerfi.app'
  );
  const unreadSupportCount = supportMessages.filter(msg => !msg.is_read).length;

  // Notify parent component of support count changes
  useEffect(() => {
    if (onSupportCountChange) {
      onSupportCountChange(unreadSupportCount);
    }
  }, [unreadSupportCount, onSupportCountChange]);

  const filteredMessages = messages.filter(message => {
    const matchesSearch = searchTerm === '' || 
      message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.sender_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.recipient_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'all' || 
      (filter === 'unread' && !message.is_read) ||
      (filter === 'read' && message.is_read) ||
      (filter === 'admin' && (message.sender_id === ADMIN_WALLET_ADDRESS || message.sender_id === 'admin@lancerfi.app')) ||
      (filter === 'support' && message.recipient_id === 'admin@lancerfi.app');
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Messages</h2>
          <p className="text-sm text-muted-foreground mt-1">Total: {messages.length} messages</p>
        </div>
        <Dialog open={newMessageDialogOpen} onOpenChange={setNewMessageDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Send className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Send New Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipient">Recipient Wallet Address</Label>
                <Input
                  id="recipient"
                  value={newMessageRecipient}
                  onChange={(e) => setNewMessageRecipient(e.target.value)}
                  placeholder="Enter wallet address"
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={newMessageSubject}
                  onChange={(e) => setNewMessageSubject(e.target.value)}
                  placeholder="Message subject"
                />
              </div>
              <div>
                <Label htmlFor="content">Message</Label>
                <Textarea
                  id="content"
                  value={newMessageContent}
                  onChange={(e) => setNewMessageContent(e.target.value)}
                  placeholder="Enter your message"
                  rows={5}
                />
              </div>
              <Button onClick={sendNewMessage} className="w-full">
                Send Message
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="admin">Admin Messages</SelectItem>
              <SelectItem value="support">Support Messages</SelectItem>
            </SelectContent>
          </Select>
          {unreadSupportCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full border-2 border-background flex items-center justify-center text-white text-xs font-bold">
              {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No messages found</p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => {
            const isFromAdmin = message.sender_id === 'admin@lancerfi.app' || message.sender_id === ADMIN_WALLET_ADDRESS;
            const isToAdmin = message.recipient_id === 'admin@lancerfi.app' || message.recipient_id === ADMIN_WALLET_ADDRESS;
            
            return (
              <Card 
                key={message.id}
                className={`cursor-pointer hover:bg-muted/50 ${!message.is_read ? 'border-l-4 border-l-primary' : ''} ${
                  isFromAdmin ? 'border-2 border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20' : ''
                }`}
                onClick={async () => {
                  setSelectedMessage(message);
                  // Mark support messages as read when clicked
                  if (isToAdmin && !message.is_read) {
                    try {
                      await db.markAdminMessageAsRead(message.id);
                      // Update local state
                      setMessages(prev => prev.map(msg => 
                        msg.id === message.id ? { ...msg, is_read: true } : msg
                      ));
                      // Trigger notification update
                      window.dispatchEvent(new CustomEvent('messageRead'));
                    } catch (error) {
                      // Silently fail
                    }
                  }
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {isFromAdmin ? (
                          <Badge variant="outline">From</Badge>
                        ) : (
                          <Badge variant="outline">From</Badge>
                        )}
                        {isToAdmin && (
                          <Badge variant="default" className="bg-blue-600 text-white">
                            Support
                          </Badge>
                        )}
                        <span className={`text-sm font-medium truncate ${isFromAdmin ? 'text-amber-700 dark:text-amber-400 font-bold' : ''}`}>
                          {isFromAdmin 
                            ? 'Administrator' 
                            : `${message.sender_id.slice(0, 8)}...${message.sender_id.slice(-6)}`}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span className={`text-sm font-medium truncate ${isToAdmin ? 'text-amber-700 dark:text-amber-400 font-bold' : ''}`}>
                          {isToAdmin
                            ? 'Administrator'
                            : `${message.recipient_id.slice(0, 8)}...${message.recipient_id.slice(-6)}`}
                        </span>
                        {!message.is_read && (
                          <Badge variant="destructive" className="text-xs">New</Badge>
                        )}
                      </div>
                    {message.subject && (
                      <h4 className="font-medium text-sm mb-1">{message.subject}</h4>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">{message.content}</p>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="w-3 h-3" />
                        <span>{message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(message.created_at), 'PPp')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReply(message);
                    }}
                  >
                    <Reply className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reply to Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <Input value={replyRecipient} disabled />
            </div>
            <div>
              <Label htmlFor="reply-subject">Subject</Label>
              <Input
                id="reply-subject"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Message subject"
              />
            </div>
            <div>
              <Label htmlFor="reply-content">Message</Label>
              <Textarea
                id="reply-content"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Enter your reply"
                rows={5}
              />
            </div>
            <Button onClick={sendReply} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Send Reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Detail Dialog */}
      {selectedMessage && (
        <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{selectedMessage.subject || 'Message Details'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>From</Label>
                <p className="text-sm">{selectedMessage.sender_id}</p>
              </div>
              <div>
                <Label>To</Label>
                <p className="text-sm">{selectedMessage.recipient_id}</p>
              </div>
              <div>
                <Label>Date</Label>
                <p className="text-sm">{format(new Date(selectedMessage.created_at), 'PPp')}</p>
              </div>
              <div>
                <Label>Message</Label>
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.content}</p>
                
                {/* Display Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Attachments:</Label>
                    {selectedMessage.attachments.map((url, index) => {
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                      const fileName = url.split('/').pop() || `attachment-${index + 1}`;
                      
                      return (
                        <div key={index} className="border rounded-lg p-2 bg-muted/30">
                          {isImage ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={url}
                                alt={fileName}
                                className="max-w-full max-h-64 object-contain rounded cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            </a>
                          ) : (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-primary hover:underline"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-sm">{fileName}</span>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    handleReply(selectedMessage);
                    setSelectedMessage(null);
                  }}
                >
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </Button>
                <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminMessages;

