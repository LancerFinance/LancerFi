import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import HowItWorksPage from "./pages/HowItWorksPage";
import FAQ from "./pages/FAQ";
import PostProject from "./pages/PostProject";
import ProjectDashboard from "./pages/ProjectDashboard";
import HireTalent from "./pages/HireTalent";
import FreelancerDashboard from "./pages/FreelancerDashboard";
import FreelancerProfile from "./pages/FreelancerProfile";
import CreateFreelancerProfile from "./pages/CreateFreelancerProfile";
import EditProfile from "./pages/EditProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/post-project" element={<PostProject />} />
        <Route path="/dashboard" element={<ProjectDashboard />} />
        <Route path="/hire-talent" element={<HireTalent />} />
        <Route path="/freelancer" element={<FreelancerDashboard />} />
        <Route path="/freelancer/:id" element={<FreelancerProfile />} />
        <Route path="/create-freelancer-profile" element={<CreateFreelancerProfile />} />
        <Route path="/edit-profile" element={<EditProfile />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
