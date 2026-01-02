import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RocketIcon } from "@/components/icons/PremiumIcons";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
        {/* 404 Text */}
        <div className="relative mb-8">
          <div className="text-[150px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-primary to-primary/20 select-none blur-2xl absolute inset-0 transform translate-y-4 opacity-50">
            404
          </div>
          <div className="text-[150px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/50 select-none relative z-10 drop-shadow-2xl">
            404
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Lost in Cyberspace?
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            The page you're looking for seems to have vanished into the void. Let's get you back to the command center.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/">
              <Button size="lg" className="bg-gradient-primary text-primary-foreground font-semibold h-12 px-8 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 group">
                <span className="flex items-center gap-2">
                  Return Home
                  <RocketIcon className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
