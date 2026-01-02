import { Link, useParams } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trophy, Medal, TrendingUp, Clock, Target } from "lucide-react";

const topWinners = [
  { rank: 1, username: "codemaster", score: 1000, time: "00:45:23", country: "🇺🇸" },
  { rank: 2, username: "algoking", score: 900, time: "00:52:10", country: "🇮🇳" },
  { rank: 3, username: "bytewizard", score: 800, time: "00:58:45", country: "🇩🇪" },
];

const userResult = {
  rank: 156,
  totalParticipants: 28934,
  score: 300,
  problemsSolved: 2,
  totalProblems: 4,
  time: "01:22:11",
  ratingChange: +15,
  problems: [
    { label: "A", title: "Array Sum Query", solved: true, points: 100, attempts: 1 },
    { label: "B", title: "Binary Tree Path", solved: true, points: 200, attempts: 2 },
    { label: "C", title: "Graph Shortest Path", solved: false, points: 0, attempts: 3 },
    { label: "D", title: "Dynamic Programming Challenge", solved: false, points: 0, attempts: 0 },
  ],
};

const ContestResults = () => {
  const { id } = useParams();

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
          <p className="text-muted-foreground">Weekly Contest 377 - Final Standings</p>
        </div>

        {/* Top 3 Winners */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Performers</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {topWinners.map((winner) => (
              <div
                key={winner.rank}
                className={`relative p-6 rounded-lg border ${
                  winner.rank === 1
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : winner.rank === 2
                    ? "bg-gray-400/10 border-gray-400/30"
                    : "bg-amber-600/10 border-amber-600/30"
                }`}
              >
                <div className="absolute top-4 right-4 text-2xl">{winner.country}</div>
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
                  <span className="font-mono">{winner.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Your Performance */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Your Performance</h2>
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-card/50 border border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Trophy className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Final Rank</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                #{userResult.rank} <span className="text-sm text-muted-foreground font-normal">/ {userResult.totalParticipants.toLocaleString()}</span>
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Score</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{userResult.score} pts</p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-xs uppercase tracking-wider">Time</span>
              </div>
              <p className="text-2xl font-bold font-mono text-foreground">{userResult.time}</p>
            </div>
            <div className="p-4 rounded-lg bg-card/50 border border-border/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Rating Change</span>
              </div>
              <p className={`text-2xl font-bold ${userResult.ratingChange > 0 ? "text-green-500" : "text-red-500"}`}>
                {userResult.ratingChange > 0 ? "+" : ""}{userResult.ratingChange}
              </p>
            </div>
          </div>

          {/* Problems Breakdown */}
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <div className="p-4 border-b border-border/30 bg-card/30">
              <h3 className="font-semibold text-foreground">Problems Breakdown</h3>
            </div>
            <div className="divide-y divide-border/30">
              {userResult.problems.map((problem) => (
                <div
                  key={problem.label}
                  className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded flex items-center justify-center font-mono font-medium ${
                      problem.solved ? "bg-green-500/20 text-green-400" : "bg-muted/30 text-muted-foreground"
                    }`}>
                      {problem.label}
                    </span>
                    <div>
                      <h4 className="text-foreground font-medium">{problem.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {problem.attempts > 0 ? `${problem.attempts} attempt${problem.attempts > 1 ? "s" : ""}` : "Not attempted"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${problem.solved ? "text-green-500" : "text-muted-foreground"}`}>
                      {problem.solved ? `+${problem.points}` : "0"} pts
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {problem.solved ? "Accepted" : problem.attempts > 0 ? "Wrong Answer" : "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

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
