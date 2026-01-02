import { Navbar } from "@/features/landing/components/Navbar";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { FeaturesSection } from "@/features/landing/components/FeaturesSection";
import { TopicsSection } from "@/features/landing/components/TopicsSection";
import { LogoMarquee } from "@/features/landing/components/LogoMarquee";
import { CTASection } from "@/features/landing/components/CTASection";
import { Footer } from "@/features/landing/components/Footer";
import { CustomCursor } from "@/components/common/CustomCursor";
import { useEffect } from "react";

const Index = () => {
  // Set dark mode by default for this tech platform
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <CustomCursor />



      <Navbar />
      <main>
        <HeroSection />
        <LogoMarquee />
        <FeaturesSection />

        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
