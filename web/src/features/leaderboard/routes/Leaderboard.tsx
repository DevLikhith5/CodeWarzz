import { useState, useEffect } from "react";
import { AppNavbar } from "@/components/layout/AppNavbar";
import api from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setIsLoading(true);
        const response = await api.get("/users/leaderboard/global"); // Adjusted route to match user.router prefix if needed, usually it's /api/v1/users/...
        // Wait, user.router is mounted at /users usually. Let's assume standard structure.
        // Checking user.router.ts, it's exported as default.
        // In server.ts (not visible but standard), typically /api/v1/users
        if (response.data.data) {
          setLeaderboardData(response.data.data.map((user: any, index: number) => ({
            rank: index + 1,
            username: user.username,
            solved: user.solvedCount || 0,
            easy: user.easy || 0,
            medium: user.medium || 0,
            hard: user.hard || 0
          })));
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "text-yellow-400";
    if (rank === 2) return "text-gray-300";
    if (rank === 3) return "text-amber-600";
    return "text-muted-foreground";
  };

  return <div className="min-h-screen bg-background">
    <AppNavbar />
    <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-5">User</div>
          <div className="col-span-2 text-center">Solved</div>
          <div className="col-span-4 grid grid-cols-3 gap-2 text-center">
            <span>Easy</span>
            <span>Med</span>
            <span>Hard</span>
          </div>
        </div>

        <div className="divide-y divide-border/30">
          {isLoading ? (
            [...Array(10)].map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center">
                <div className="col-span-1"><Skeleton className="h-6 w-8 mx-auto" /></div>
                <div className="col-span-5"><Skeleton className="h-6 w-32" /></div>
                <div className="col-span-2"><Skeleton className="h-6 w-12 mx-auto" /></div>
                <div className="col-span-4 grid grid-cols-3 gap-2">
                  <Skeleton className="h-6 w-8 mx-auto" />
                  <Skeleton className="h-6 w-8 mx-auto" />
                  <Skeleton className="h-6 w-8 mx-auto" />
                </div>
              </div>
            ))
          ) : (
            leaderboardData.map(user => <div key={user.rank} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/5 transition-colors">
              <div className="col-span-1 text-center">
                <span className={`font-bold text-lg ${getRankStyle(user.rank)}`}>
                  {user.rank}
                </span>
              </div>
              <div className="col-span-5 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' :
                  user.rank === 2 ? 'bg-gray-300/20 text-gray-300' :
                    user.rank === 3 ? 'bg-amber-600/20 text-amber-600' :
                      'bg-primary/10 text-primary'
                  }`}>
                  {user.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-foreground font-medium">{user.username}</span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-foreground font-bold text-lg">{user.solved}</span>
              </div>
              <div className="col-span-4 grid grid-cols-3 gap-2 text-center text-sm">
                <span className="text-green-500 font-medium">{user.easy}</span>
                <span className="text-yellow-500 font-medium">{user.medium}</span>
                <span className="text-red-500 font-medium">{user.hard}</span>
              </div>
            </div>)
          )}

        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-border/30">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="py-4">
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))
        ) : (
          leaderboardData.map(user => (
            <div key={user.rank} className="py-4 hover-lift">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-lg ${getRankStyle(user.rank)}`}>
                    #{user.rank}
                  </span>
                  <span className="text-foreground font-medium">{user.username}</span>
                </div>
                <span className="text-foreground font-semibold">{user.solved} solved</span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-500">{user.easy} Easy</span>
                <span className="text-yellow-500">{user.medium} Med</span>
                <span className="text-red-500">{user.hard} Hard</span>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  </div>;
};
export default Leaderboard;