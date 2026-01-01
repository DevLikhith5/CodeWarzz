import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { TopicsSection } from "@/components/landing/TopicsSection";
import { LogoMarquee } from "@/components/landing/LogoMarquee";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { CustomCursor } from "@/components/CustomCursor";
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
