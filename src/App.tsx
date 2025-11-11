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
import ProjectDetails from "./pages/ProjectDetails";
import EditProject from "./pages/EditProject";
import ViewProposals from "./pages/ViewProposals";
import SubmitProposal from "./pages/SubmitProposal";
import Messages from "./pages/Messages";
import BrowseServices from "./pages/BrowseServices";
import ServiceDetails from "./pages/ServiceDetails";
import AdminDashboard from "./pages/AdminDashboard";
import { WalletProvider } from "@/hooks/useWallet";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
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
        <Route path="/project/:id" element={<ProjectDetails />} />
        <Route path="/project/:id/edit" element={<EditProject />} />
        <Route path="/project/:id/proposals" element={<ViewProposals />} />
        <Route path="/project/:projectId/submit-proposal" element={<SubmitProposal />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/browse-services" element={<BrowseServices />} />
        <Route path="/service/:id" element={<ServiceDetails />} />
        <Route path="/error-message" element={<AdminDashboard />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
