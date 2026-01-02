import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { ChevronLeft, Trophy, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { toast } from "sonner";

const leaderboardData = [
  { rank: 1, username: "codemaster", score: 1000, time: "00:45:23", problems: [true, true, true, true] },
  { rank: 2, username: "algoking", score: 900, time: "00:52:10", problems: [true, true, true, false] },
  { rank: 3, username: "bytewizard", score: 800, time: "00:58:45", problems: [true, true, false, true] },
  { rank: 4, username: "devninja", score: 700, time: "01:02:33", problems: [true, true, true, false] },
  { rank: 5, username: "stackhero", score: 600, time: "01:08:12", problems: [true, true, false, false] },
  { rank: 6, username: "bitmaster", score: 500, time: "01:12:45", problems: [true, false, true, false] },
  { rank: 7, username: "codefury", score: 400, time: "01:18:22", problems: [true, true, false, false] },
  { rank: 8, username: "algopro", score: 300, time: "01:22:11", problems: [true, false, false, false] },
  { rank: 9, username: "hacksmith", score: 200, time: "01:25:33", problems: [false, true, false, false] },
  { rank: 10, username: "devmaster", score: 100, time: "01:28:45", problems: [true, false, false, false] },
];

const problemLabels = ["A", "B", "C", "D"];

const ContestLeaderboard = () => {
  const { id } = useParams();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [problems, setProblems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRank, setUserRank] = useState<any>(null); // For "Your Rank" section

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setIsLoading(true);
        const response = await api.get(`/contests/${id}/leaderboard`);
        const data = response.data.data;

        setProblems(data.problems);
        setLeaderboard(data.leaderboard);

        // Find current user's rank (mock logic: assuming we can identify user from response or separate call)
        // Ideally backend returns 'yourRank' or we find it in the list if full list is fetched.
        // For now, let's just leave it null unless we find a matching username if we had auth context here.

      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        toast.error("Failed to load leaderboard");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchLeaderboard();
      // Set up polling every 30 seconds for live updates
      const interval = setInterval(fetchLeaderboard, 30000);
      return () => clearInterval(interval);
    }
  }, [id]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 text-center font-bold text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />

      {/* Immersive Background Effect */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-3/4 h-[500px] bg-primary/10 blur-[120px] rounded-full opacity-50" />
        <div className="absolute bottom-[-10%] left-0 w-1/2 h-[500px] bg-primary/5 blur-[120px] rounded-full opacity-30" />
      </div>

      <main className="container mx-auto px-4 md:px-6 pt-24 pb-12 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            to={`/contest/${id}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Contest
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Contest Leaderboard</h1>
              <p className="text-muted-foreground">Live Rankings</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>



        {/* Leaderboard Table */}
        <div className="rounded-lg border border-border/30 overflow-hidden bg-card/10 backdrop-blur-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 bg-card/30 border-b border-border/30 text-sm font-medium text-muted-foreground">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">User</div>
            <div className="col-span-2">Score</div>
            <div className="col-span-2">Time</div>
            <div className="col-span-3 flex gap-2 justify-end">
              {problems.map((prob, idx) => (
                <span key={prob.id} className="w-8 text-center" title={prob.title}>
                  {String.fromCharCode(65 + idx)}
                </span>
              ))}
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border/30">
            {isLoading ? (
              <div className="p-12 flex justify-center text-muted-foreground">Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div className="p-12 flex justify-center text-muted-foreground">No submissions yet.</div>
            ) : (
              leaderboard.map((user) => (
                <div
                  key={user.userId}
                  className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors ${user.rank <= 3 ? "bg-primary/5" : ""
                    }`}
                >
                  <div className="col-span-1 flex items-center">
                    {getRankIcon(user.rank)}
                  </div>
                  <div className="col-span-4">
                    <span className="text-foreground font-medium">{user.username}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-foreground font-semibold">{user.score}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground font-mono text-sm">{user.timeFormatted}</span>
                  </div>
                  <div className="col-span-3 flex gap-2 justify-end">
                    {problems.map((prob) => {
                      const stats = user.problemStats[prob.id];
                      const solved = stats?.solved;
                      const attempts = stats?.attempts || 0;

                      return (
                        <div key={prob.id} className="flex flex-col items-center w-8">
                          <span
                            className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${solved
                              ? "bg-green-500/20 text-green-400"
                              : (attempts > 0 ? "bg-red-500/10 text-red-500" : "bg-muted/30 text-muted-foreground")
                              }`}
                          >
                            {solved ? "✓" : (attempts > 0 ? `-${attempts}` : "-")}
                          </span>
                          {solved && stats?.timeMs > 0 && (
                            <span className="text-[10px] text-muted-foreground mt-0.5 hidden">
                              {Math.floor(stats.timeMs / 60000)}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )))}
          </div>
        </div>

        {/* Your Rank (Optional - hidden for now as we don't calculate it simply) */}
        {/* <div className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5">...</div> */}
      </main>
    </div>
  );
};

export default ContestLeaderboard;
