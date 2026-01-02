import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { Search, CheckCircle2, Circle, Minus, Plus } from "lucide-react";
import { PageTransition } from "@/components/layout/PageTransition";
import { StaggerContainer } from "@/components/common/StaggerContainer";
import { problemRepository } from "@/repositories/problem.repository";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";

interface Problem {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  acceptance: string;
  status: "Solved" | "Attempted" | "Unsolved";
  topics: string[];
  slug: string;
}

const difficultyFilters = ["All", "Easy", "Medium", "Hard"];
const statusFilters = ["All", "Solved", "Attempted", "Unsolved"];

const Problems = () => {
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        setIsLoading(true);
        const response = await problemRepository.getProblems(1, 50);
        const mappedProblems = response.data.map((p: any) => {
          let status: "Solved" | "Attempted" | "Unsolved" = "Unsolved";
          if (p.userStatus === "AC" || p.userStatus === "Solved") {
            status = "Solved";
          } else if (p.userStatus && p.userStatus !== "Unsolved") {
            status = "Attempted";
          }

          return {
            id: p.id,
            title: p.title,
            difficulty: p.difficulty,
            acceptance: (p.stats.totalSubmissions > 0)
              ? `${((p.stats.acceptedSubmissions / p.stats.totalSubmissions) * 100).toFixed(1)}%`
              : "-",
            status: status,
            topics: p.tags || [],
            slug: p.slug
          };
        });
        setProblems(mappedProblems);
      } catch (error) {
        console.error("Failed to fetch problems:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProblems();
  }, []);

  const filteredProblems = problems.filter(problem => {
    const matchesDifficulty = difficultyFilter === "All" || problem.difficulty === difficultyFilter.toUpperCase();
    const matchesStatus = statusFilter === "All" || problem.status === statusFilter;
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDifficulty && matchesStatus && matchesSearch;
  });

  const getDifficultyStyles = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "text-green-400 bg-green-400/10 border border-green-400/20";
      case "MEDIUM":
        return "text-amber-400 bg-amber-400/10 border border-amber-400/20";
      case "HARD":
        return "text-red-400 bg-red-400/10 border border-red-400/20";
      default:
        return "text-muted-foreground bg-muted/10 border border-border/30";
    }
  };

  const AdminOnlyAddButton = () => {
    const { user } = useAuthStore();
    if (user?.role !== 'admin') return null;

    return (
      <Link to="/problems/create" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Add Problem
      </Link>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Solved":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "Attempted":
        return <Circle className="w-5 h-5 text-amber-500" />;
      default:
        return <Minus className="w-5 h-5 text-muted-foreground/30" />;
    }
  };

  return <div className="min-h-screen bg-background">
    <AppNavbar />
    <PageTransition>
      <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
        {/* Header */}
        <div className="mb-10 flex items-center justify-end">
          {/* <div>
            <h1 className="text-3xl font-bold text-foreground">Problems</h1>
            <p className="text-muted-foreground mt-2">Sharpen your skills with our collection of coding challenges.</p>
          </div> */}
          {/* Only show Add Problem for ADMIN role. Assuming user object is available in scope or needs to be fetched from store */}
          <AdminOnlyAddButton />
        </div>

        {/* Search & Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input type="text" placeholder="Search problems..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none transition-all border-b border-border/50 focus:border-primary" />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              <span className="text-sm text-muted-foreground shrink-0">Difficulty:</span>
              <div className="flex gap-1">
                {difficultyFilters.map(filter => <button key={filter} onClick={() => setDifficultyFilter(filter)} className={`px-3 py-1.5 text-sm rounded-lg transition-all tap-scale ${difficultyFilter === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"}`}>
                  {filter}
                </button>)}
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              <span className="text-sm text-muted-foreground shrink-0">Status:</span>
              <div className="flex gap-1">
                {statusFilters.map(filter => <button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-1.5 text-sm rounded-lg transition-all tap-scale ${statusFilter === filter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/20"}`}>
                  {filter}
                </button>)}
              </div>
            </div>
          </div>
        </div>

        {/* Problems List */}
        <div className="divide-y divide-border/30">
          {/* Header Row */}
          <div className="hidden md:flex items-center gap-4 px-4 py-3 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="w-16 shrink-0 text-center">Status</div>
            <div className="flex-1">Title</div>
            <div className="w-24">Difficulty</div>
            <div className="w-16 text-right">Acceptance</div>
          </div>

          <StaggerContainer>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-4 px-2">
                    <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-[200px]" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                    </div>
                    <Skeleton className="w-24 h-6 rounded-lg" />
                    <Skeleton className="w-16 h-4 hidden md:block" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {filteredProblems.map((problem) => <Link key={problem.id} to={`/problems/${problem.id}`} className="group flex items-center gap-3 md:gap-4 py-4 hover:bg-muted/5 transition-all duration-200 hover-lift">
                  {/* Status Icon */}
                  <div className="w-16 flex-shrink-0 flex justify-center">
                    {getStatusIcon(problem.status)}
                  </div>

                  {/* Problem Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="text-sm md:text-base text-foreground font-medium group-hover:text-primary transition-colors truncate">
                        {problem.title}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 mt-1.5">
                      {problem.topics.slice(0, 3).map(topic => <span key={topic} className="text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">
                        {topic}
                      </span>)}
                    </div>
                  </div>

                  {/* Difficulty Badge */}
                  <div className={`w-24 px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-medium flex items-center justify-center ${getDifficultyStyles(problem.difficulty)}`}>
                    {problem.difficulty}
                  </div>

                  {/* Acceptance Rate */}
                  <div className="hidden md:block text-sm text-muted-foreground w-16 text-right">
                    {problem.acceptance}
                  </div>
                </Link>)}

                {filteredProblems.length === 0 && <div className="py-12 text-center text-muted-foreground">
                  No problems found matching your filters.
                </div>}
              </>
            )}

          </StaggerContainer>
        </div>
      </main>
    </PageTransition>
  </div >;
};
export default Problems;