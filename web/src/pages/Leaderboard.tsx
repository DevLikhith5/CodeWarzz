import { AppNavbar } from "@/components/app/AppNavbar";
const leaderboardData = [{
  rank: 1,
  username: "codemaster",
  solved: 1847,
  easy: 620,
  medium: 890,
  hard: 337
}, {
  rank: 2,
  username: "algoking",
  solved: 1756,
  easy: 600,
  medium: 850,
  hard: 306
}, {
  rank: 3,
  username: "bytewizard",
  solved: 1689,
  easy: 580,
  medium: 820,
  hard: 289
}, {
  rank: 4,
  username: "devninja",
  solved: 1534,
  easy: 540,
  medium: 750,
  hard: 244
}, {
  rank: 5,
  username: "stackhero",
  solved: 1423,
  easy: 500,
  medium: 700,
  hard: 223
}, {
  rank: 6,
  username: "bitmaster",
  solved: 1367,
  easy: 480,
  medium: 670,
  hard: 217
}, {
  rank: 7,
  username: "codefury",
  solved: 1298,
  easy: 460,
  medium: 630,
  hard: 208
}, {
  rank: 8,
  username: "algopro",
  solved: 1245,
  easy: 440,
  medium: 610,
  hard: 195
}, {
  rank: 9,
  username: "hacksmith",
  solved: 1189,
  easy: 420,
  medium: 580,
  hard: 189
}, {
  rank: 10,
  username: "devmaster",
  solved: 1134,
  easy: 400,
  medium: 560,
  hard: 174
}];
const Leaderboard = () => {
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
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-sm font-medium text-muted-foreground">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">User</div>
            <div className="col-span-2">Solved</div>
            <div className="col-span-1">Easy</div>
            <div className="col-span-2">Medium</div>
            <div className="col-span-2">Hard</div>
          </div>

          <div className="divide-y divide-border">
            {leaderboardData.map(user => <div key={user.rank} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 transition-colors hover-lift">
                <div className="col-span-1">
                  <span className={`font-bold ${getRankStyle(user.rank)}`}>
                    {user.rank}
                  </span>
                </div>
                <div className="col-span-4">
                  <span className="text-foreground font-medium">{user.username}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-foreground font-semibold">{user.solved}</span>
                </div>
                <div className="col-span-1">
                  <span className="text-green-500">{user.easy}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-yellow-500">{user.medium}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-red-500">{user.hard}</span>
                </div>
              </div>)}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-border/30">
          {leaderboardData.map(user => (
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
          ))}
        </div>
      </main>
    </div>;
};
export default Leaderboard;