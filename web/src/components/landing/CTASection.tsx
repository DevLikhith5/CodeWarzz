import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/icons/PremiumIcons";
import { ScrollAnimationWrapper } from "@/components/ScrollAnimationWrapper";

export const CTASection = () => {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

      {/* Top Dome/Arch Light Effect */}
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[150%] md:w-[120%] h-[400px] rounded-[100%] bg-primary/5 blur-[80px] pointer-events-none" />
      <div className="absolute top-[-220px] left-1/2 -translate-x-1/2 w-[150%] md:w-[120%] h-[420px] rounded-[100%] border-b border-primary/20 pointer-events-none opacity-50" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <ScrollAnimationWrapper>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              Ready to Level Up Your
              <br />
              <span className="text-gradient-primary">Coding Skills?</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="bg-gradient-primary text-primary-foreground font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
                Get Started for Free
                <ArrowRightIcon size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button variant="outline" size="lg" className="font-semibold px-8 py-6 text-lg">
                View Problems
              </Button>
            </div>
          </div>
        </ScrollAnimationWrapper>
      </div>
    </section>
  );
};