import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  MessageSquare, 
  Search, 
  Send, 
  Clock, 
  User,
  Mail,
  MailOpen,
  Reply,
  Trash2,
  ArrowLeft,
  Loader2,
  HelpCircle
} from "lucide-react";
import { db, Message } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import MessageDialog from "@/components/MessageDialog";

interface MessageWithSender extends Message {
  sender_name?: string;
  recipient_name?: string;
}

const Messages = () => {
  const { toast } = useToast();
  const { isConnected, address, connectWallet } = useWallet();
  
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<MessageWithSender | null>(null);
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [lastMarkAllTime, setLastMarkAllTime] = useState<number>(0);

  useEffect(() => {
    if (isConnected && address) {
      loadMessages();
    }
  }, [address, isConnected]);

  const loadMessages = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const messagesData = await db.getMessagesForUser(address);
      
      // Enhance messages with sender/recipient names by looking up profiles
      const enhancedMessages = await Promise.all(
        messagesData.map(async (message) => {
          let sender_name = message.sender_id;
          let recipient_name = message.recipient_id;
          
          try {
            // Try to get sender profile
            const senderProfile = await db.getProfileByWallet(message.sender_id);
            if (senderProfile) {
              sender_name = senderProfile.full_name || senderProfile.username || message.sender_id;
            }
          } catch {
            // Use wallet address if profile not found
            sender_name = `${message.sender_id.slice(0, 6)}...${message.sender_id.slice(-4)}`;
          }
          
          try {
            // Try to get recipient profile  
            const recipientProfile = await db.getProfileByWallet(message.recipient_id);
            if (recipientProfile) {
              recipient_name = recipientProfile.full_name || recipientProfile.username || message.recipient_id;
            }
          } catch {
            // Use wallet address if profile not found
            recipient_name = `${message.recipient_id.slice(0, 6)}...${message.recipient_id.slice(-4)}`;
          }
          
          return { ...message, sender_name, recipient_name };
        })
      );
      
      setMessages(enhancedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!address) return;
    
    try {
      await db.markMessageAsRead(messageId, address);
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, is_read: true } : msg
      ));
      
      // Force header to refresh unread count by dispatching a custom event
      window.dispatchEvent(new CustomEvent('messageRead'));
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = searchTerm === '' || 
      message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.sender_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      message.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'all' || 
      (filter === 'received' && message.recipient_id === address) ||
      (filter === 'sent' && message.sender_id === address);
    
    return matchesSearch && matchesFilter;
  });

  const receivedMessages = messages.filter(msg => msg.recipient_id === address);
  const sentMessages = messages.filter(msg => msg.sender_id === address);
  const unreadCount = receivedMessages.filter(msg => !msg.is_read).length;

  const markAllAsRead = async () => {
    if (!address) return;
    
    // Spam protection: prevent clicking too quickly (within 2 seconds)
    const now = Date.now();
    if (now - lastMarkAllTime < 2000) {
      toast({
        title: "Please wait",
        description: "You're clicking too fast. Please wait a moment before marking all messages as read again.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if there are any unread messages
    const unreadMessages = receivedMessages.filter(msg => !msg.is_read);
    if (unreadMessages.length === 0) {
      toast({
        title: "No unread messages",
        description: "All messages are already read.",
        variant: "default"
      });
      return;
    }
    
    setMarkingAllAsRead(true);
    setLastMarkAllTime(now);
    
    try {
      // Mark all unread messages as read
      await Promise.all(
        unreadMessages.map(msg => db.markMessageAsRead(msg.id, address!))
      );
      
      // Update local state
      setMessages(prev => prev.map(msg => 
        msg.recipient_id === address && !msg.is_read 
          ? { ...msg, is_read: true } 
          : msg
      ));
      
      // Force header to refresh unread count
      window.dispatchEvent(new CustomEvent('messageRead'));
      
      toast({
        title: "All messages marked as read",
        description: `Marked ${unreadMessages.length} message${unreadMessages.length === 1 ? '' : 's'} as read.`,
      });
    } catch (error) {
      console.error('Error marking all messages as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark all messages as read. Please try again.",
        variant: "destructive"
      });
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Connect your wallet</h1>
            <p className="text-muted-foreground mb-6">Please connect your wallet to view your messages.</p>
            <Button onClick={connectWallet}>Connect Wallet</Button>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <Link to="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
              <MessageSquare className="w-8 h-8 mr-3 text-web3-primary" />
              Messages
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-destructive text-destructive-foreground">
                  {unreadCount} new
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">Manage your conversations with clients and freelancers</p>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              {/* Read All Button */}
              {unreadCount > 0 && (
                <div className="mb-4">
                  <Button
                    onClick={markAllAsRead}
                    disabled={markingAllAsRead}
                    className="w-full bg-white text-black border border-gray-300 hover:bg-gray-50"
                    variant="outline"
                  >
                    {markingAllAsRead ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Marking as read...
                      </>
                    ) : (
                      <>
                        <MailOpen className="w-4 h-4 mr-2" />
                        Read All
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filter Messages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Button
                      data-filter-button
                      data-filter="all"
                      variant={filter === 'all' ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setFilter('all')}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      All Messages ({messages.length})
                    </Button>
                    <Button
                      data-filter-button
                      data-filter="received"
                      variant={filter === 'received' ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setFilter('received')}
                    >
                      <MailOpen className="w-4 h-4 mr-2" />
                      Received ({receivedMessages.length})
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-auto">
                          {unreadCount}
                        </Badge>
                      )}
                    </Button>
                    <Button
                      data-filter-button
                      data-filter="sent"
                      variant={filter === 'sent' ? 'default' : 'ghost'}
                      className="w-full justify-start"
                      onClick={() => setFilter('sent')}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Sent ({sentMessages.length})
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Support Button */}
              <Card className="mt-4 bg-white">
                <CardContent className="p-0">
                  <SupportButtonWrapper 
                    address={address} 
                    loadMessages={loadMessages}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Messages List */}
            <div className="lg:col-span-3">
              {filteredMessages.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      {searchTerm || filter !== 'all' ? 'No matching messages' : 'No messages yet'}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {searchTerm || filter !== 'all' 
                        ? 'Try adjusting your search or filter'
                        : 'Start conversations with clients and freelancers'
                      }
                    </p>
                    {!searchTerm && filter === 'all' && (
                      <div className="space-y-2">
                        <Link to="/hire-talent">
                          <Button variant="outline">Find Freelancers</Button>
                        </Link>
                        <Link to="/dashboard" className="block">
                          <Button variant="ghost">View Your Projects</Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredMessages.map((message) => {
                    const isReceived = message.recipient_id === address;
                    const otherParty = isReceived 
                      ? { id: message.sender_id, name: message.sender_name }
                      : { id: message.recipient_id, name: message.recipient_name };
                    
                    return (
                      <Card 
                        key={message.id}
                        data-message-id={message.id}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedMessage?.id === message.id ? 'border-web3-primary' : ''
                        } ${
                          isReceived && !message.is_read 
                            ? 'border-l-4 border-l-web3-primary !bg-white' 
                            : '!bg-muted/30'
                        }`}
                        onClick={() => {
                          setSelectedMessage(message);
                          if (isReceived && !message.is_read) {
                            markAsRead(message.id);
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <Avatar className="w-10 h-10">
                              <AvatarImage src="" />
                              <AvatarFallback>
                                {otherParty.name?.slice(0, 2).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-foreground truncate">
                                    {otherParty.name || 'Unknown User'}
                                  </h4>
                                  <Badge variant="outline" className="text-xs">
                                    {isReceived ? 'From' : 'To'}
                                  </Badge>
                                  {isReceived && !message.is_read && (
                                    <Badge className="text-xs bg-black text-white">
                                      New
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {new Date(message.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              
                              {message.subject && (
                                <h5 className="font-medium text-sm text-foreground mb-1 truncate">
                                  {message.subject}
                                </h5>
                              )}
                              
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {message.content}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Message Detail Modal/Panel */}
          {selectedMessage && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src="" />
                        <AvatarFallback>
                          {(selectedMessage.sender_id === address 
                            ? selectedMessage.recipient_name 
                            : selectedMessage.sender_name)?.slice(0, 2).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold">
                          {selectedMessage.sender_id === address 
                            ? selectedMessage.recipient_name 
                            : selectedMessage.sender_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(selectedMessage.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMessage(null)}>
                      ✕
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="p-6 overflow-y-auto">
                  {selectedMessage.subject && (
                    <div className="mb-4">
                      <h4 className="font-medium text-foreground">Subject:</h4>
                      <p className="text-muted-foreground">{selectedMessage.subject}</p>
                    </div>
                  )}
                  
                  <div className="mb-6">
                    <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedMessage.content}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {selectedMessage.sender_id === 'system@lancerfi.app' ? (
                      <Button 
                        variant="default" 
                        className="flex-1" 
                        disabled
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Send Message
                      </Button>
                    ) : (
                      <MessageDialog
                        recipientId={selectedMessage.sender_id === address 
                          ? selectedMessage.recipient_id 
                          : selectedMessage.sender_id}
                        recipientName={
                          selectedMessage.sender_id === address 
                            ? selectedMessage.recipient_name || 
                              (selectedMessage.recipient_id.length > 20
                                ? `${selectedMessage.recipient_id.slice(0, 6)}...${selectedMessage.recipient_id.slice(-4)}`
                                : selectedMessage.recipient_id)
                            : selectedMessage.sender_name || 
                              (selectedMessage.sender_id.length > 20
                                ? `${selectedMessage.sender_id.slice(0, 6)}...${selectedMessage.sender_id.slice(-4)}`
                                : selectedMessage.sender_id)
                        }
                        projectTitle={selectedMessage.subject ? `Re: ${selectedMessage.subject}` : undefined}
                        triggerVariant="default"
                        triggerClassName="flex-1"
                      />
                    )}
                    <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                      Close
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Support Button Component
interface SupportButtonWrapperProps {
  address: string | null;
  loadMessages: () => void;
}

const SupportButtonWrapper = ({ address, loadMessages }: SupportButtonWrapperProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();
  
  const handleSupportClick = () => {
    if (!address) return;
    // Always open new message dialog
    setShowDialog(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-center bg-white hover:bg-muted/50"
        onClick={handleSupportClick}
      >
        <HelpCircle className="w-4 h-4 mr-2" />
        Support
      </Button>
      {showDialog && (
        <MessageDialog
          recipientId="admin@lancerfi.app"
          recipientName="Support"
          triggerVariant="outline"
          triggerClassName="hidden"
          triggerText="Support"
          triggerIcon={<HelpCircle className="w-4 h-4 mr-2" />}
          requireSubject={true}
          onMessageSent={() => {
            setShowDialog(false);
            loadMessages();
          }}
          open={showDialog}
          onOpenChange={setShowDialog}
        />
      )}
    </>
  );
};

export default Messages;