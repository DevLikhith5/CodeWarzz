import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MenuIcon, CloseIcon, ArrowRightIcon } from "@/components/icons/PremiumIcons";

const navLinks = [
  { name: "Problems", href: "#problems" },
  { name: "Contest", href: "#contest" },
  { name: "Discuss", href: "#discuss" },
  { name: "Leaderboard", href: "#leaderboard" },
];

export const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-background/20"
          : "bg-transparent"
        }`}
    >
      <div className="container mx-auto px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center group">
            <span className="text-xl md:text-2xl font-bold tracking-tight transition-all duration-300 group-hover:drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]">
              <span className="text-muted-foreground group-hover:text-foreground transition-colors duration-300">Code</span>
              <span className="text-primary">Warz</span>
            </span>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center">
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-card/30 border border-border/30 backdrop-blur-sm">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="relative px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-all duration-300 rounded-full hover:bg-primary/10 group"
                >
                  <span className="relative z-10">{link.name}</span>
                  <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                </a>
              ))}
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link to="/auth">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-transparent relative group px-4"
              >
                <span className="relative z-10">Sign In</span>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gradient-primary group-hover:w-3/4 transition-all duration-300" />
              </Button>
            </Link>
            <Button
              className="relative overflow-hidden bg-gradient-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-[1.02] group"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started
                <ArrowRightIcon size={16} className="group-hover:translate-x-0.5 transition-transform duration-300" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl bg-card/30 border border-border/30 text-foreground hover:bg-card/50 transition-all duration-300"
          >
            {isMobileMenuOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-6 animate-fade-in">
            <div className="flex flex-col gap-2 p-4 rounded-2xl bg-card/50 border border-border/30 backdrop-blur-xl">
              {navLinks.map((link, index) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-all duration-300 font-medium py-3 px-4 rounded-xl hover:bg-primary/10"
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {link.name}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-border/30">
                <Link to="/auth" className="w-full">
                  <Button variant="ghost" className="w-full justify-center font-medium py-3">
                    Sign In
                  </Button>
                </Link>
                <Button className="w-full bg-gradient-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-lg shadow-primary/20">
                  <span className="flex items-center gap-2">
                    Get Started
                    <ArrowRightIcon size={16} />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
