const features = [{
  title: "3,000+ Curated Problems",
  description: "From easy warmups to hard challenges, covering every algorithm and data structure topic.",
  size: "large",
  visual: "code"
}, {
  title: "Weekly Contests",
  description: "Compete with developers worldwide in timed competitions.",
  size: "small",
  visual: "trophy"
}, {
  title: "Progress Analytics",
  description: "Track your improvement with detailed statistics and skill assessments.",
  size: "small",
  visual: "chart"
}, {
  title: "AI-Powered Hints",
  description: "Get intelligent hints and explanations without spoiling the solution approach.",
  size: "medium",
  visual: "brain"
}];
const CodeVisual = () => <div className="absolute inset-0 overflow-hidden bg-background/50">
  <div className="absolute top-4 left-4 right-4 font-mono text-xs text-orange-400 leading-relaxed font-bold">
    <div className="flex items-center gap-2 mb-3">
      <span className="w-3 h-3 rounded-full bg-red-500" />
      <span className="w-3 h-3 rounded-full bg-yellow-500" />
      <span className="w-3 h-3 rounded-full bg-green-500" />
    </div>
    <div className="text-orange-400">{"def solve(nums):"}</div>
    <div className="text-zinc-400 pl-4">{"left, right = 0, len(nums)"}</div>
    <div className="text-zinc-400 pl-4">{"while left < right:"}</div>
    <div className="text-orange-300 pl-8">{"mid = (left + right) // 2"}</div>
    <div className="text-zinc-400 pl-8">{"if nums[mid] == target:"}</div>
    <div className="text-green-400 pl-12">{"return mid"}</div>
  </div>
</div>;
const TrophyVisual = () => <div className="absolute bottom-4 right-4 w-20 h-20">
  <div className="relative w-full h-full">
    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-yellow-500/20 rounded-full blur-xl animate-pulse" />
    <svg viewBox="0 0 64 64" className="relative w-full h-full">
      <defs>
        <linearGradient id="trophy-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path d="M20 12h24v6c0 8-4 14-12 16-8-2-12-8-12-16v-6z" fill="url(#trophy-grad)" opacity="0.9" />
      <path d="M12 12h8v4c-4 0-6-2-6-4h-2z" fill="url(#trophy-grad)" opacity="0.7" />
      <path d="M44 12h8v0c0 2-2 4-6 4v-4z" fill="url(#trophy-grad)" opacity="0.7" />
      <rect x="28" y="34" width="8" height="8" fill="url(#trophy-grad)" opacity="0.8" />
      <rect x="24" y="42" width="16" height="4" rx="1" fill="url(#trophy-grad)" opacity="1" />
    </svg>
  </div>
</div>;
const ChartVisual = () => <div className="absolute bottom-4 right-4 flex items-end gap-1.5 h-16">
  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => <div key={i} className="w-2 rounded-t bg-gradient-to-t from-orange-600 to-orange-400" style={{
    height: `${h}%`,
    animationDelay: `${i * 0.1}s`
  }} />)}
</div>;
const BrainVisual = () => <div className="absolute top-1/2 right-8 -translate-y-1/2 w-24 h-24 opacity-80">
  <div className="relative w-full h-full">
    <div className="absolute inset-0 border-2 border-orange-500/40 rounded-full" />
    <div className="absolute inset-2 border border-orange-400/30 rounded-full" />
    <div className="absolute inset-4 border border-orange-500/20 rounded-full" />
    {[...Array(6)].map((_, i) => <div key={i} className="absolute w-2 h-2 bg-orange-400 rounded-full" style={{
      top: `${50 + 35 * Math.sin(i * Math.PI * 2 / 6)}%`,
      left: `${50 + 35 * Math.cos(i * Math.PI * 2 / 6)}%`,
      transform: 'translate(-50%, -50%)'
    }} />)}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-4 h-4 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full animate-pulse" />
    </div>
  </div>
</div>;
const UsersVisual = () => <div className="absolute bottom-4 right-4 flex -space-x-3">
  {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-300 border-2 border-card flex items-center justify-center shadow-lg" style={{
    zIndex: 5 - i
  }} />)}
</div>;
const LightningVisual = () => <div className="absolute inset-0 overflow-hidden">
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 opacity-50">
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <defs>
        <linearGradient id="lightning-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>
      <path d="M36 4L16 32h12L24 60l24-32H34L36 4z" fill="url(#lightning-grad)" />
    </svg>
  </div>
  <div className="absolute bottom-4 left-4 right-4 flex gap-2">
    {['Python', 'Java', 'C++', 'Go', 'Rust'].map((lang, i) => <span key={lang} className="px-2 py-1 text-[10px] font-mono rounded bg-orange-500/20 text-orange-100 border border-orange-500/30 font-bold">
      {lang}
    </span>)}
  </div>
</div>;
const getVisual = (visual: string) => {
  switch (visual) {
    case 'code':
      return <CodeVisual />;
    case 'trophy':
      return <TrophyVisual />;
    case 'chart':
      return <ChartVisual />;
    case 'brain':
      return <BrainVisual />;
    case 'users':
      return <UsersVisual />;
    case 'lightning':
      return <LightningVisual />;
    default:
      return null;
  }
};
import { ScrollAnimationWrapper } from "@/components/common/ScrollAnimationWrapper";

export const FeaturesSection = () => {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden" id="features">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-secondary/20 to-background" />

      {/* Central Spotlight Glow */}
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[80%] md:w-[60%] h-[300px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <ScrollAnimationWrapper>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Everything You Need to
              <span className="block mt-2 bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent"> Master Algorithms</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto text-muted-foreground">
              A comprehensive platform designed to take your coding skills from beginner to expert level.
            </p>
          </div>
        </ScrollAnimationWrapper>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-[180px]">
          {/* Large Card 1 - Problems */}
          <ScrollAnimationWrapper delay={100} className="md:col-span-2 md:row-span-2">
            <div className="group relative h-full rounded-[32px_4px_32px_4px] border border-border/50 bg-gradient-to-br from-card via-card to-card/80 p-6 overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CodeVisual />
              <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="inline-flex items-center gap-2 mb-3">
                  {/* <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    Core Feature
                  </span> */}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                  3,000+ Curated Problems
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  From easy warmups to hard challenges, covering every algorithm and data structure topic.
                </p>
              </div>
            </div>
          </ScrollAnimationWrapper>

          {/* Small Card - Contests */}
          <ScrollAnimationWrapper delay={200}>
            <div className="group relative h-full rounded-[24px_4px_24px_4px] border border-border/50 bg-gradient-to-br from-card to-card/80 p-5 overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
              <TrophyVisual />
              <div className="relative z-10 h-full flex flex-col">
                <h3 className="text-lg font-bold mb-1 text-foreground group-hover:text-primary transition-colors">
                  Weekly Contests
                </h3>
                <p className="text-sm text-muted-foreground">
                  Compete globally in timed competitions.
                </p>
              </div>
            </div>
          </ScrollAnimationWrapper>

          {/* Small Card - Analytics */}
          <ScrollAnimationWrapper delay={300}>
            <div className="group relative h-full rounded-[24px_4px_24px_4px] border border-border/50 bg-gradient-to-br from-card to-card/80 p-5 overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
              <ChartVisual />
              <div className="relative z-10 h-full flex flex-col">
                <h3 className="text-lg font-bold mb-1 text-foreground group-hover:text-primary transition-colors">
                  Progress Analytics
                </h3>
                <p className="text-sm text-muted-foreground">
                  Track improvement with detailed stats.
                </p>
              </div>
            </div>
          </ScrollAnimationWrapper>

          {/* Medium Card - AI */}
          <ScrollAnimationWrapper delay={400} className="md:col-span-2">
            <div className="group relative h-full rounded-[4px_32px_4px_32px] border border-border/50 bg-gradient-to-br from-card to-card/80 p-6 overflow-hidden transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.3)]">
              <BrainVisual />
              <div className="relative z-10 h-full flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 mb-2 w-fit">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 uppercase tracking-wider">
                    AI Powered
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2 text-foreground group-hover:text-primary transition-colors">
                  Intelligent Hints System
                </h3>
                <p className="text-muted-foreground max-w-xs">
                  Get smart hints and explanations without spoiling the solution approach.
                </p>
              </div>
            </div>
          </ScrollAnimationWrapper>

        </div>
      </div>
    </section>
  );
};