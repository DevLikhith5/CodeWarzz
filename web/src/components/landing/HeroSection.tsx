import { Button } from "@/components/ui/button";
import { ArrowRightIcon, TerminalIcon } from "@/components/icons/PremiumIcons";
import heroImage from "@/assets/hero/image.png";

export const HeroSection = () => {
  return <section className="relative min-h-screen pt-32 pb-20 overflow-hidden">
    {/* Background Effects */}
    <div className="absolute inset-0 bg-gradient-hero" />
    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
    <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{
      animationDelay: "1.5s"
    }} />

    {/* Grid Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

    {/* Orange Radiating Horizon Effect */}
    <div className="absolute bottom-[-400px] left-1/2 -translate-x-1/2 w-[200%] md:w-[150%] lg:w-[120%] h-[800px] rounded-[100%] border-t border-primary/50 shadow-[0_-20px_100px_hsl(var(--primary)/0.4)] opacity-60 pointer-events-none" />
    <div className="absolute bottom-[-400px] left-1/2 -translate-x-1/2 w-[200%] md:w-[150%] lg:w-[120%] h-[800px] rounded-[100%] bg-[radial-gradient(circle_at_bottom,transparent_30%,hsl(var(--primary)/0.2)_80%,transparent)] pointer-events-none" />

    <div className="container mx-auto px-4 md:px-6 relative z-10">
      <div className="max-w-5xl mx-auto text-center">
        {/* Badge */}


        {/* Main Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up" style={{
          animationDelay: "0.1s"
        }}>
          Master the Art of
          <br />
          <span className="text-gradient-primary">Algorithmic Thinking</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-slide-up" style={{
          animationDelay: "0.2s"
        }}>
          Practice coding, prepare for interviews, and sharpen your algorithmic
          thinking with curated problems and weekly contests.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{
          animationDelay: "0.3s"
        }}>
          <Button size="lg" className="bg-gradient-primary text-primary-foreground font-semibold px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
            Start Coding Free
            <ArrowRightIcon size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button variant="outline" size="lg" className="font-semibold px-8 py-6 text-lg border-border hover:bg-secondary transition-all">
            <TerminalIcon size={20} className="mr-2" />
            View Problems
          </Button>
        </div>
      </div>

      {/* Hero Image / Browser Window */}
      <div className="mt-16 relative z-10 animate-slide-up max-w-4xl mx-auto px-4" style={{
        animationDelay: "0.4s"
      }}>
        <div className="group relative rounded-xl border border-border/50 bg-white shadow-2xl overflow-hidden">
          {/* Window Header */}
          <div className="px-4 py-3 bg-zinc-100 border-b border-zinc-200 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
          </div>
          {/* Window Content */}
          <div className="relative">
            <img
              src={heroImage}
              alt="Developer coding platform preview"
              className="w-full h-auto block"
            />
          </div>
        </div>

        {/* Background Glow behind the window */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/20 blur-[100px] -z-10 rounded-full pointer-events-none opacity-50" />
      </div>
    </div>
  </section>;
};