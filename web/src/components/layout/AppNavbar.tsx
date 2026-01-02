import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, Sun, User, LogOut, Menu, X } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Problems", path: "/problems" },
  { name: "Contests", path: "/contests" },
  { name: "Leaderboard", path: "/leaderboard" },
];

export const AppNavbar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-xl font-bold transition-all duration-300 hover:opacity-80 group"
          >
            <span className="text-muted-foreground group-hover:drop-shadow-[0_0_8px_hsl(var(--muted-foreground)/0.5)]">
              Code
            </span>
            <span className="text-primary group-hover:drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]">
              Warz
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-1 py-2 text-sm font-medium transition-all duration-200 group ${location.pathname === link.path
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <span className="relative z-10">{link.name}</span>
                <div
                  className={`absolute bottom-0 left-0 right-0 h-[2px] bg-primary transition-all duration-200 ${location.pathname === link.path ? "w-full" : "w-0 group-hover:w-full"
                    }`}
                />
              </Link>
            ))}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full hover:bg-primary/10 tap-scale"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-primary/10 tap-scale"
                >
                  <User className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer">
                  <div className="flex items-center gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden rounded-full hover:bg-primary/10 tap-scale"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Menu className="h-5 w-5 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${location.pathname === link.path
                    ? "text-foreground bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                    }`}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
