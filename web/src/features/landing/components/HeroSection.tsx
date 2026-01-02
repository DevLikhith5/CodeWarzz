import { Button } from "@/components/ui/button";
import { ArrowRightIcon, TerminalIcon } from "@/components/icons/PremiumIcons";
import heroImage from "@/assets/hero/image.png";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

export const HeroSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const bgglow1Ref = useRef<HTMLDivElement>(null);
  const bgglow2Ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();

    // Reset initial states
    gsap.set([titleRef.current, subtitleRef.current, buttonsRef.current], { opacity: 0, y: 50 });
    gsap.set(imageRef.current, { opacity: 0, y: 100, rotationX: 10 });
    gsap.set([bgglow1Ref.current, bgglow2Ref.current], { opacity: 0, scale: 0.5 });

    tl.to([bgglow1Ref.current, bgglow2Ref.current], {
      opacity: 1,
      scale: 1,
      duration: 1.5,
      ease: "power2.out",
      stagger: 0.2
    })
      .to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power4.out"
      }, "-=1")
      .to(subtitleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out"
      }, "-=0.6")
      .to(buttonsRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "back.out(1.7)"
      }, "-=0.4")
      .to(imageRef.current, {
        opacity: 1,
        y: 0,
        rotationX: 0,
        duration: 1.2,
        ease: "power3.out"
      }, "-=0.4");

    // Continuous floating animation for glows
    gsap.to(bgglow1Ref.current, {
      x: "20px",
      y: "-20px",
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });

    gsap.to(bgglow2Ref.current, {
      x: "-20px",
      y: "20px",
      duration: 5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: 1
    });

  }, { scope: containerRef });

  return <section ref={containerRef} className="relative min-h-screen pt-32 pb-20 overflow-hidden prospective-1000">
    {/* Background Effects */}
    <div className="absolute inset-0 bg-gradient-hero" />
    <div ref={bgglow1Ref} className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-0" />
    <div ref={bgglow2Ref} className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl opacity-0" />

    {/* Grid Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

    {/* Orange Radiating Horizon Effect */}
    <div className="absolute bottom-[-400px] left-1/2 -translate-x-1/2 w-[200%] md:w-[150%] lg:w-[120%] h-[800px] rounded-[100%] border-t border-primary/50 shadow-[0_-20px_100px_hsl(var(--primary)/0.4)] opacity-60 pointer-events-none" />
    <div className="absolute bottom-[-400px] left-1/2 -translate-x-1/2 w-[200%] md:w-[150%] lg:w-[120%] h-[800px] rounded-[100%] bg-[radial-gradient(circle_at_bottom,transparent_30%,hsl(var(--primary)/0.2)_80%,transparent)] pointer-events-none" />

    <div className="container mx-auto px-4 md:px-6 relative z-10">
      <div className="max-w-5xl mx-auto text-center">
        {/* Main Headline */}
        <h1 ref={titleRef} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 opacity-0">
          Master the Art of
          <br />
          <span className="text-gradient-primary">Algorithmic Thinking</span>
        </h1>

        {/* Subheadline */}
        <p ref={subtitleRef} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 opacity-0">
          Practice coding, prepare for interviews, and sharpen your algorithmic
          thinking with curated problems and weekly contests.
        </p>

        {/* CTA Buttons */}
        <div ref={buttonsRef} className="flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0">
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
      <div ref={imageRef} className="mt-16 relative z-10 max-w-4xl mx-auto px-4 opacity-0" style={{ transformStyle: "preserve-3d" }}>
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