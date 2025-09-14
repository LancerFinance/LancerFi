import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";
import JobCategories from "@/components/JobCategories";
import ValueProposition from "@/components/ValueProposition";
import Roadmap from "@/components/Roadmap";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <ValueProposition />
      <HowItWorks />
      <JobCategories />
      <Roadmap />
    </div>
  );
};

export default Index;
