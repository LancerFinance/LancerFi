import { useState } from "react";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Activity, Briefcase, Users } from "lucide-react";
import AdminMessages from "@/components/admin/AdminMessages";
import AdminSystemStatus from "@/components/admin/AdminSystemStatus";
import AdminProjects from "@/components/admin/AdminProjects";
import AdminUsers from "@/components/admin/AdminUsers";

type AdminSection = 'messages' | 'system' | 'projects' | 'users';

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState<AdminSection>('messages');

  const sections = [
    { id: 'messages' as AdminSection, label: 'Messages', icon: MessageSquare },
    { id: 'system' as AdminSection, label: 'System Status', icon: Activity },
    { id: 'projects' as AdminSection, label: 'Projects', icon: Briefcase },
    { id: 'users' as AdminSection, label: 'Users', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-6 sm:mb-8">
            Admin Dashboard
          </h1>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? 'default' : 'outline'}
                  className="h-auto py-4 sm:py-6 flex flex-col items-center gap-2 sm:gap-3"
                  onClick={() => setActiveSection(section.id)}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-xs sm:text-sm font-medium">{section.label}</span>
                </Button>
              );
            })}
          </div>

          {/* Content Section */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              {activeSection === 'messages' && <AdminMessages />}
              {activeSection === 'system' && <AdminSystemStatus />}
              {activeSection === 'projects' && <AdminProjects />}
              {activeSection === 'users' && <AdminUsers />}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;

