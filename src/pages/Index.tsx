import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturedServices from "@/components/FeaturedServices";
import CategoryGrid from "@/components/CategoryGrid";
import ExploreFreelancers from "@/components/ExploreFreelancers";
import FrontendRoadmap from "@/components/FrontendRoadmap";
import ValueProposition from "@/components/ValueProposition";
import HowItWorks from "@/components/HowItWorks";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <FeaturedServices />
      <CategoryGrid />
      <ExploreFreelancers />
      <FrontendRoadmap />
      <ValueProposition />
      <HowItWorks />
    </div>
  );
};

export default Index;
