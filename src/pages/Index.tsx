import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturedServices from "@/components/FeaturedServices";
import CategoryGrid from "@/components/CategoryGrid";
import ExploreFreelancers from "@/components/ExploreFreelancers";
import HowItWorks from "@/components/HowItWorks";
import ValueProposition from "@/components/ValueProposition";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <FeaturedServices />
      <CategoryGrid />
      <ExploreFreelancers />
      <ValueProposition />
      <HowItWorks />
    </div>
  );
};

export default Index;
