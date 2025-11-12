import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Ban, Volume2, VolumeX, Shield, Copy, Check } from "lucide-react";
import { db, Profile, supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useWallet } from "@/hooks/useWallet";

const AdminUsers = () => {
  const { toast } = useToast();
  const { address, signMessage } = useWallet();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [restrictDialogOpen, setRestrictDialogOpen] = useState(false);
  const [restrictionType, setRestrictionType] = useState<'mute' | 'ban' | 'ip_ban'>('mute');
  const [ipAddress, setIpAddress] = useState('');
  const [banReason, setBanReason] = useState('');
  const [duration, setDuration] = useState<string>('7'); // Default 7 days
  const [warnDialogOpen, setWarnDialogOpen] = useState(false);
  const [warnReason, setWarnReason] = useState('');
  const [muteHistory, setMuteHistory] = useState<Record<string, number>>({}); // profile_id -> mute count in last 7 days
  const [copiedWallet, setCopiedWallet] = useState<string | null>(null); // Track which wallet was copied

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await db.getAllProfiles();
      setUsers(data || []);
      
      // Load mute history for all users
      await loadMuteHistory(data || []);
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

  const loadMuteHistory = async (profiles: Profile[]) => {
    try {
      const profileIds = profiles.map(p => p.id);
      if (profileIds.length === 0) return;

      const { data, error } = await supabase
        .from('mute_history')
        .select('profile_id, muted_at')
        .in('profile_id', profileIds)
        .gte('muted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (error) throw error;

      // Count mutes per profile in last 7 days
      const muteCounts: Record<string, number> = {};
      (data || []).forEach((record: any) => {
        muteCounts[record.profile_id] = (muteCounts[record.profile_id] || 0) + 1;
      });

      setMuteHistory(muteCounts);
    } catch (error) {
      console.error('Error loading mute history:', error);
    }
  };

  const handleRestrict = (user: Profile) => {
    setSelectedUser(user);
    setRestrictDialogOpen(true);
  };

  const handleWarn = (user: Profile) => {
    setSelectedUser(user);
    setWarnDialogOpen(true);
  };

  const applyWarning = async () => {
    if (!selectedUser) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          warning_count: (selectedUser.warning_count || 0) + 1,
          last_warning_at: new Date().toISOString(),
          last_warning_reason: warnReason.trim() || null
        })
        .eq('id', selectedUser.id)
        .select()
        .single();

      if (error) throw error;

      // Send warning message to user
      try {
        await db.createMessage({
          sender_id: 'system@lancerfi.app',
          recipient_id: selectedUser.wallet_address || selectedUser.id,
          subject: 'Warning from Admin',
          content: `You have been warned by an administrator.${warnReason.trim() ? ` Reason: ${warnReason.trim()}` : ''}`
        });
      } catch (msgError) {
        console.error('Error sending warning message:', msgError);
      }

      toast({
        title: "Success",
        description: `User warned successfully. Warning count: ${data.warning_count}`
      });

      setWarnDialogOpen(false);
      setSelectedUser(null);
      setWarnReason('');
      loadUsers();
    } catch (error) {
      console.error('Error applying warning:', error);
      toast({
        title: "Error",
        description: "Failed to apply warning",
        variant: "destructive"
      });
    }
  };

  const applyRestriction = async () => {
    if (!selectedUser) return;

    if (!address) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive"
      });
      return;
    }

    if (restrictionType === 'ip_ban' && !ipAddress.trim()) {
      toast({
        title: "Error",
        description: "Please enter an IP address",
        variant: "destructive"
      });
      return;
    }

    // Validate duration (0 = permanent, otherwise must be >= 0.1)
    const durationNum = parseFloat(duration);
    if (isNaN(durationNum) || (durationNum !== 0 && durationNum < 0.1)) {
      toast({
        title: "Error",
        description: "Duration must be 0 (permanent) or at least 0.1 days",
        variant: "destructive"
      });
      return;
    }

    try {
      // Calculate expiration date (duration in days)
      const expiresAt = durationNum > 0 
        ? new Date(Date.now() + durationNum * 24 * 60 * 60 * 1000).toISOString()
        : null; // 0 or negative = permanent
      
      if (restrictionType === 'mute') {
        // Check mute limit (3 mutes per week)
        const muteCount = muteHistory[selectedUser.id] || 0;
        if (muteCount >= 3) {
          toast({
            title: "Mute Limit Reached",
            description: "This user has been muted 3 times in the past 7 days. Cannot mute again.",
            variant: "destructive"
          });
          return;
        }
      }

      // Map frontend restriction types to backend types
      const backendRestrictionType = restrictionType === 'mute' ? 'mute' : 
                                     restrictionType === 'ban' ? 'ban_wallet' : 
                                     'ban_ip';

      // Authenticate with backend
      // Use relative URL in production (same domain), or env variable, or fallback
      const API_BASE_URL = import.meta.env.VITE_API_URL ||
        (import.meta.env.PROD ? '' : 'http://localhost:3001');

      // No signature required - admin wallet is already verified by dashboard access
      // Call backend API
      const response = await fetch(`${API_BASE_URL}/api/admin/restrict-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          profileId: selectedUser.id,
          restrictionType: backendRestrictionType,
          expiresAt,
          reason: banReason.trim() || null,
          ipAddress: restrictionType === 'ip_ban' ? ipAddress.trim() : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: `User ${restrictionType === 'mute' ? 'muted' : restrictionType === 'ban' ? 'banned' : 'IP banned'} successfully${expiresAt ? ` for ${duration} days` : ' permanently'}`
      });
      
      setRestrictDialogOpen(false);
      setSelectedUser(null);
      setRestrictionType('mute');
      setIpAddress('');
      setBanReason('');
      setDuration('7');
      
      // Reload users and mute history
      const updatedUsers = await db.getAllProfiles();
      setUsers(updatedUsers || []);
      await loadMuteHistory(updatedUsers || []);
    } catch (error: any) {
      console.error('Error applying restriction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to apply restriction",
        variant: "destructive"
      });
    }
  };

  const removeRestriction = async (user: Profile) => {
    if (!address) {
      toast({
        title: "Error",
        description: "Wallet not connected",
        variant: "destructive"
      });
      return;
    }

    try {
      // Use relative URL in production (same domain), or env variable, or fallback
      const API_BASE_URL = import.meta.env.VITE_API_URL ||
        (import.meta.env.PROD ? '' : 'http://localhost:3001');

      // Generate challenge and sign it
      const timestamp = Date.now();
      const nonce = Math.random().toString(36).substring(2);
      const challenge = `LancerFi Admin Unrestrict\nTimestamp: ${timestamp}\nNonce: ${nonce}\n\nThis signature proves you own this wallet.`;
      
      let signature: Uint8Array;
      try {
        const signed = await signMessage(challenge);
        signature = signed.signature;
      } catch (signError: any) {
        if (signError.message?.includes('canceled') || signError.message?.includes('rejected')) {
          return; // User canceled, don't show error
        }
        throw signError;
      }

      // Convert signature to base64 (browser-compatible)
      const signatureBase64 = btoa(String.fromCharCode(...Array.from(signature)));

      // Call backend API
      const response = await fetch(`${API_BASE_URL}/api/admin/unrestrict-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          signature: signatureBase64,
          message: challenge,
          profileId: user.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      toast({
        title: "Success",
        description: `Restriction removed successfully`
      });
      
      // Reload users and mute history
      const updatedUsers = await db.getAllProfiles();
      setUsers(updatedUsers || []);
      await loadMuteHistory(updatedUsers || []);
    } catch (error: any) {
      console.error('Error removing restriction:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove restriction",
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
                      {muteHistory[user.id] !== undefined && muteHistory[user.id] >= 3 && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400">
                          Muted 3 times in past 7 days
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <p>Wallet: {user.wallet_address || 'N/A'}</p>
                        {user.wallet_address && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(user.wallet_address!);
                                setCopiedWallet(user.wallet_address);
                                toast({
                                  title: "Wallet Copied",
                                  description: "Wallet address copied to clipboard",
                                });
                                // Reset copied state after 2 seconds
                                setTimeout(() => setCopiedWallet(null), 2000);
                              } catch (err) {
                                console.error('Failed to copy wallet:', err);
                                toast({
                                  title: "Copy Failed",
                                  description: "Failed to copy wallet address",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            {copiedWallet === user.wallet_address ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                      {user.email && <p>Email: {user.email}</p>}
                      {user.username && <p>Username: {user.username}</p>}
                      {user.created_at && (
                        <p>Joined: {format(new Date(user.created_at), 'PPp')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(!user.is_muted && !user.is_banned) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWarn(user)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Warn
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestrict(user)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Restrict
                        </Button>
                      </>
                    )}
                    {(user.is_muted || user.is_banned) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestrict(user)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Restrict
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeRestriction(user)}
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          Unrestrict
                        </Button>
                      </>
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
            <div>
              <Label htmlFor="duration">Duration (days)</Label>
              <Input
                id="duration"
                type="number"
                min="0.1"
                step="0.1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Enter duration in days (0.1 minimum)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter 0 for permanent restriction
              </p>
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

      {/* Warning Dialog */}
      <Dialog open={warnDialogOpen} onOpenChange={setWarnDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Warn User</DialogTitle>
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
              <Label htmlFor="warn-reason">Reason (Optional)</Label>
              <Textarea
                id="warn-reason"
                value={warnReason}
                onChange={(e) => setWarnReason(e.target.value)}
                placeholder="Enter reason for warning"
                rows={3}
              />
            </div>
            <Button onClick={applyWarning} className="w-full">
              Send Warning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;

