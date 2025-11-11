import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Ban, Volume2, VolumeX, Shield } from "lucide-react";
import { db, Profile } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [restrictDialogOpen, setRestrictDialogOpen] = useState(false);
  const [restrictionType, setRestrictionType] = useState<'mute' | 'ban' | 'ip_ban'>('mute');
  const [ipAddress, setIpAddress] = useState('');
  const [banReason, setBanReason] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await db.getAllProfiles();
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestrict = (user: Profile) => {
    setSelectedUser(user);
    setRestrictDialogOpen(true);
  };

  const applyRestriction = async () => {
    if (!selectedUser) return;

    if (restrictionType === 'ip_ban' && !ipAddress.trim()) {
      toast({
        title: "Error",
        description: "Please enter an IP address",
        variant: "destructive"
      });
      return;
    }

    try {
      const restrictions: any = {};
      
      if (restrictionType === 'mute') {
        restrictions.is_muted = true;
      } else if (restrictionType === 'ban') {
        restrictions.is_banned = true;
      } else if (restrictionType === 'ip_ban') {
        // Get existing banned IPs or initialize empty array
        const existingBans = selectedUser.banned_ip_addresses || [];
        restrictions.banned_ip_addresses = [...existingBans, ipAddress.trim()];
      }

      await db.updateUserRestrictions(selectedUser.id, restrictions);
      
      toast({
        title: "Success",
        description: `User ${restrictionType === 'mute' ? 'muted' : restrictionType === 'ban' ? 'banned' : 'IP banned'} successfully`
      });
      
      setRestrictDialogOpen(false);
      setSelectedUser(null);
      setRestrictionType('mute');
      setIpAddress('');
      setBanReason('');
      loadUsers();
    } catch (error) {
      console.error('Error applying restriction:', error);
      toast({
        title: "Error",
        description: "Failed to apply restriction",
        variant: "destructive"
      });
    }
  };

  const removeRestriction = async (user: Profile, type: 'mute' | 'ban') => {
    try {
      const restrictions: any = {};
      if (type === 'mute') {
        restrictions.is_muted = false;
      } else if (type === 'ban') {
        restrictions.is_banned = false;
      }

      await db.updateUserRestrictions(user.id, restrictions);
      
      toast({
        title: "Success",
        description: `Restriction removed successfully`
      });
      
      loadUsers();
    } catch (error) {
      console.error('Error removing restriction:', error);
      toast({
        title: "Error",
        description: "Failed to remove restriction",
        variant: "destructive"
      });
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return searchTerm === '' || 
      user.wallet_address?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower) ||
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">All Users</h2>
        <p className="text-sm text-muted-foreground mt-1">Total: {users.length} users</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search users by wallet, username, name, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-base sm:text-lg">
                        {user.full_name || user.username || 'Unnamed User'}
                      </h3>
                      {user.is_muted && (
                        <Badge variant="outline" className="bg-yellow-500/10">
                          <VolumeX className="w-3 h-3 mr-1" />
                          Muted
                        </Badge>
                      )}
                      {user.is_banned && (
                        <Badge variant="destructive">
                          <Ban className="w-3 h-3 mr-1" />
                          Banned
                        </Badge>
                      )}
                      {user.banned_ip_addresses && user.banned_ip_addresses.length > 0 && (
                        <Badge variant="outline" className="bg-red-500/10">
                          <Shield className="w-3 h-3 mr-1" />
                          IP Banned ({user.banned_ip_addresses.length})
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>Wallet: {user.wallet_address || 'N/A'}</p>
                      {user.email && <p>Email: {user.email}</p>}
                      {user.username && <p>Username: {user.username}</p>}
                      {user.created_at && (
                        <p>Joined: {format(new Date(user.created_at), 'PPp')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {user.is_muted && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeRestriction(user, 'mute')}
                      >
                        <Volume2 className="w-4 h-4 mr-2" />
                        Unmute
                      </Button>
                    )}
                    {user.is_banned && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeRestriction(user, 'ban')}
                      >
                        Unban
                      </Button>
                    )}
                    {(!user.is_muted && !user.is_banned) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestrict(user)}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Restrict
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Restriction Dialog */}
      <Dialog open={restrictDialogOpen} onOpenChange={setRestrictDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Restrict User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User</Label>
              <Input 
                value={selectedUser?.wallet_address || ''} 
                disabled 
              />
            </div>
            <div>
              <Label htmlFor="restriction-type">Restriction Type</Label>
              <Select value={restrictionType} onValueChange={(value: any) => setRestrictionType(value)}>
                <SelectTrigger id="restriction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mute">Mute User</SelectItem>
                  <SelectItem value="ban">Ban User (Wallet)</SelectItem>
                  <SelectItem value="ip_ban">Ban IP Address</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {restrictionType === 'ip_ban' && (
              <div>
                <Label htmlFor="ip-address">IP Address</Label>
                <Input
                  id="ip-address"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="Enter IP address to ban"
                />
              </div>
            )}
            <div>
              <Label htmlFor="ban-reason">Reason (Optional)</Label>
              <Textarea
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for restriction"
                rows={3}
              />
            </div>
            <Button onClick={applyRestriction} className="w-full">
              Apply Restriction
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;

