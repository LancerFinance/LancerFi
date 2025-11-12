import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface SystemStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  lastCheck: Date;
  error?: string;
}

const AdminSystemStatus = () => {
  const [systems, setSystems] = useState<SystemStatus[]>([
    { name: 'Database', status: 'offline', lastCheck: new Date() },
    { name: 'Storage', status: 'offline', lastCheck: new Date() },
    { name: 'API Server', status: 'offline', lastCheck: new Date() },
    { name: 'Blockchain RPC', status: 'offline', lastCheck: new Date() },
  ]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? 'https://server-sepia-alpha-52.vercel.app' : 'http://localhost:3001');

  const fetchSystemStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/system-status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch system status');
      }

      const data = await response.json();
      
      if (data.success && data.systems) {
        const systemList: SystemStatus[] = [
          {
            name: 'Database',
            status: data.systems.database?.status || 'offline',
            lastCheck: new Date(data.systems.database?.lastCheck || Date.now()),
            error: data.systems.database?.error
          },
          {
            name: 'Storage',
            status: data.systems.storage?.status || 'offline',
            lastCheck: new Date(data.systems.storage?.lastCheck || Date.now()),
            error: data.systems.storage?.error
          },
          {
            name: 'API Server',
            status: data.systems.apiServer?.status || 'offline',
            lastCheck: new Date(data.systems.apiServer?.lastCheck || Date.now()),
            error: data.systems.apiServer?.error
          },
          {
            name: 'Blockchain RPC',
            status: data.systems.blockchainRPC?.status || 'offline',
            lastCheck: new Date(data.systems.blockchainRPC?.lastCheck || Date.now()),
            error: data.systems.blockchainRPC?.error
          },
        ];
        setSystems(systemList);
        setLastRefresh(new Date());
      }
    } catch (error: any) {
      // If fetch fails, mark all systems as offline
      setSystems([
        { name: 'Database', status: 'offline', lastCheck: new Date(), error: error.message },
        { name: 'Storage', status: 'offline', lastCheck: new Date(), error: error.message },
        { name: 'API Server', status: 'offline', lastCheck: new Date(), error: error.message },
        { name: 'Blockchain RPC', status: 'offline', lastCheck: new Date(), error: error.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'offline':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-green-500">Online</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-500">Degraded</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">System Status</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor system health and API endpoints
          </p>
        </div>
        <Button
          onClick={fetchSystemStatus}
          disabled={loading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {systems.map((system) => (
          <Card key={system.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg">{system.name}</CardTitle>
                {getStatusIcon(system.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  {getStatusBadge(system.status)}
                  <p className="text-xs text-muted-foreground">
                    Last check: {system.lastCheck.toLocaleTimeString()}
                  </p>
                </div>
                {system.error && (
                  <p className="text-xs text-destructive mt-2">
                    Error: {system.error}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            API Status Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            System status is automatically checked every 30 seconds. Last refresh: {lastRefresh.toLocaleTimeString()}
          </p>
          <div className="mt-4 space-y-2">
            <div className="text-sm">
              <code className="bg-muted px-2 py-1 rounded">GET /api/system-status</code>
              <span className="ml-2 text-xs text-muted-foreground">- Real-time system health check</span>
            </div>
            <div className="text-sm">
              <code className="bg-muted px-2 py-1 rounded">GET /health</code>
              <span className="ml-2 text-xs text-muted-foreground">- API server health check</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemStatus;

