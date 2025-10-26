import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FeaturedServices from "@/components/FeaturedServices";
import CategoryGrid from "@/components/CategoryGrid";
import TrustIndicators from "@/components/TrustIndicators";
import HowItWorks from "@/components/HowItWorks";
import ValueProposition from "@/components/ValueProposition";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <TrustIndicators />
      <FeaturedServices />
      <CategoryGrid />
      <ValueProposition />
      <HowItWorks />
    </div>
  );
};

export default Index;
