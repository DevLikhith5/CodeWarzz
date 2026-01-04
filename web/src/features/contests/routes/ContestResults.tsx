import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trophy, Medal, TrendingUp, Target } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { toast } from "sonner";

interface ProblemStat {
  solved: boolean;
  attempts: number;
  timeMs: number;
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  rank: number;
  score: number;
  timeFormatted: string;
  country?: string; // Not currently in API
  problemStats: Record<string, ProblemStat>;
  totalTimeMs: number;
}

interface ContestProblem {
  id: string;
  title: string;
}

const ContestResults = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [problems, setProblems] = useState<ContestProblem[]>([]);
  const [currentUserResult, setCurrentUserResult] = useState<LeaderboardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/contests/${id}/leaderboard`);
        const data = response.data.data;

        setLeaderboard(data.leaderboard);
        setProblems(data.problems);

        // Find current user's result
        if (user) {
          const userEntry = data.leaderboard.find((entry: LeaderboardEntry) => entry.userId === user.id);
          setCurrentUserResult(userEntry || null);
        }

      } catch (error) {
        console.error("Failed to fetch contest results:", error);
        toast.error("Failed to load contest results");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchResults();
    }
  }, [id, user]);

  const topWinners = leaderboard.slice(0, 3);

  const getProblemLabel = (index: number) => String.fromCharCode(65 + index);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <main className="container mx-auto px-4 md:px-6 pt-24 pb-12 flex justify-center items-center h-[50vh]">
          <p className="text-muted-foreground">Loading results...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/contests"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Contests
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Contest Results</h1>
          <p className="text-muted-foreground">Final Standings</p>
        </div>

        {/* Top 3 Winners */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Performers</h2>
          {topWinners.length === 0 ? (
            <p className="text-muted-foreground">No participants found.</p>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {topWinners.map((winner) => (
                <div
                  key={winner.rank}
                  className={`relative p-6 rounded-lg border ${winner.rank === 1
                      ? "bg-yellow-500/10 border-yellow-500/30"
                      : winner.rank === 2
                        ? "bg-gray-400/10 border-gray-400/30"
                        : "bg-amber-600/10 border-amber-600/30"
                    }`}
                >
                  {/* Country flag placeholder if we add it later */}
                  {/* <div className="absolute top-4 right-4 text-2xl">{winner.country}</div> */}
                  <div className="flex items-center gap-3 mb-4">
                    {winner.rank === 1 ? (
                      <Trophy className="w-8 h-8 text-yellow-400" />
                    ) : (
                      <Medal className={`w-8 h-8 ${winner.rank === 2 ? "text-gray-300" : "text-amber-600"}`} />
                    )}
                    <span className="text-3xl font-bold text-foreground">#{winner.rank}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{winner.username}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{winner.score} pts</span>
                    <span className="font-mono">{winner.timeFormatted}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Your Performance */}
        {currentUserResult && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Your Performance</h2>
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Trophy className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Final Rank</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  #{currentUserResult.rank} <span className="text-sm text-muted-foreground font-normal">/ {leaderboard.length.toLocaleString()}</span>
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Score</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{currentUserResult.score} pts</p>
              </div>
              <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span className="text-xs uppercase tracking-wider">Time</span>
                </div>
                <p className="text-2xl font-bold font-mono text-foreground">{currentUserResult.timeFormatted}</p>
              </div>
              <div className="p-4 rounded-lg bg-card/50 border border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs uppercase tracking-wider">Rating Change</span>
                </div>
                <p className="text-2xl font-bold text-muted-foreground">
                  - {/* Rating change not supported yet */}
                </p>
              </div>
            </div>

            {/* Problems Breakdown */}
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <div className="p-4 border-b border-border/30 bg-card/30">
                <h3 className="font-semibold text-foreground">Problems Breakdown</h3>
              </div>
              <div className="divide-y divide-border/30">
                {problems.map((problem, index) => {
                  const probStat = currentUserResult.problemStats[problem.id];
                  const solved = probStat?.solved || false;
                  const attempts = probStat?.attempts || 0;
                  // Max score is not in LeaderboardEntry struct from backend currently, assuming 100 or need to wait for update
                  // But we don't have max score in problemStats either.
                  // Existing frontend code had points.
                  // For now, if solved, just show "Solved". Or we can assume strict scoring if we had it.
                  // Let's just show status.

                  return (
                    <div
                      key={problem.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded flex items-center justify-center font-mono font-medium ${solved ? "bg-green-500/20 text-green-400" : "bg-muted/30 text-muted-foreground"
                          }`}>
                          {getProblemLabel(index)}
                        </span>
                        <div>
                          <h4 className="text-foreground font-medium">{problem.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {attempts > 0 ? `${attempts} attempt${attempts > 1 ? "s" : ""}` : "Not attempted"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${solved ? "text-green-500" : "text-muted-foreground"}`}>
                          {solved ? "Solved" : "-"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {solved ? "Accepted" : attempts > 0 ? "Wrong Answer" : "-"}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button asChild>
            <Link to="/problems">Practice Similar Problems</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contests">View More Contests</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ContestResults;
