import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppNavbar } from "@/components/app/AppNavbar";
import api from "@/lib/api";
import { Search, CheckCircle2, Circle, Minus, Plus } from "lucide-react";
interface Problem {
  id: string; // Changed to string as likely UUID from DB
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  acceptance: string;
  status: "Solved" | "Attempted" | "Unsolved" | "Todo"; // Updated status
  topics: string[];
  tags: string[];
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
        const response = await api.get("/problems");
        if (response.data?.data) {
          const mappedProblems = response.data.data.map((p: any) => ({
            id: p.id,
            title: p.title,
            difficulty: p.difficulty,
            acceptance: "N/A", // Placeholder as backend might not calculate this yet
            status: "Todo", // Default status, ideally should be fetched from user progress
            topics: p.tags || [],
            tags: p.tags || []
          }));
          setProblems(mappedProblems);
        }
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
    const matchesStatus = statusFilter === "All" || (statusFilter === "Unsolved" ? problem.status === "Todo" : problem.status === statusFilter);
    const matchesSearch = problem.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDifficulty && matchesStatus && matchesSearch;
  });

  const getDifficultyStyles = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "text-emerald-500 bg-emerald-500/10";
      case "MEDIUM":
        return "text-amber-500 bg-amber-500/10";
      case "HARD":
        return "text-rose-500 bg-rose-500/10";
      default:
        return "text-muted-foreground bg-muted/10";
    }
  };

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
    <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Problems</h1>
          <p className="text-muted-foreground mt-2">Sharpen your skills with our collection of coding challenges.</p>
        </div>
        <Link to="/problems/create" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Problem
        </Link>
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
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading problems...</p>
          </div>
        ) : (
          <>
            {filteredProblems.map((problem) => <Link key={problem.id} to={`/problems/${problem.id}`} className="group flex items-center gap-3 md:gap-4 py-4 hover:bg-muted/5 transition-all duration-200 hover-lift">
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {getStatusIcon(problem.status)}
              </div>

              {/* Problem Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-xs md:text-sm text-muted-foreground font-mono">{problem.id.slice(0, 8)}</span>
                  <span className="text-sm md:text-base text-foreground font-medium group-hover:text-primary transition-colors truncate">
                    {problem.title}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-2 mt-1.5">
                  {problem.topics.slice(0, 2).map(topic => <span key={topic} className="text-xs text-muted-foreground bg-muted/20 px-2 py-0.5 rounded">
                    {topic}
                  </span>)}
                </div>
              </div>

              {/* Difficulty Badge */}
              <div className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm font-medium ${getDifficultyStyles(problem.difficulty)}`}>
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
      </div>
    </main>
  </div>;
};
export default Problems;