import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle, XCircle, Clock } from "lucide-react";

const AdminSystemStatus = () => {
  // Placeholder for system status - user will add API fetching here
  const systems = [
    { name: 'Database', status: 'online', lastCheck: new Date() },
    { name: 'Storage', status: 'online', lastCheck: new Date() },
    { name: 'API Server', status: 'online', lastCheck: new Date() },
    { name: 'Blockchain RPC', status: 'online', lastCheck: new Date() },
  ];

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
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">System Status</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor system health and API endpoints
        </p>
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
              <div className="flex items-center justify-between">
                {getStatusBadge(system.status)}
                <p className="text-xs text-muted-foreground">
                  Last check: {system.lastCheck.toLocaleTimeString()}
                </p>
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
          <p className="text-sm text-muted-foreground">
            Add your API fetching logic here to check system status in real-time.
          </p>
          <div className="mt-4 space-y-2">
            <div className="text-sm">
              <code className="bg-muted px-2 py-1 rounded">GET /api/health</code>
            </div>
            <div className="text-sm">
              <code className="bg-muted px-2 py-1 rounded">GET /api/database/status</code>
            </div>
            <div className="text-sm">
              <code className="bg-muted px-2 py-1 rounded">GET /api/storage/status</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemStatus;

