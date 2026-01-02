import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { AppNavbar } from "@/features/landing/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Users, Trophy, Calendar, ChevronRight, Plus } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ContestProblem {
  id: string;
  title: string;
  points: number;
  solved: boolean;
  difficulty: string;
}

// Removed unused contestProblems constant

// Removed unused contestInfo constant

const ContestDetail = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [contest, setContest] = useState<any>(null);
  const [problems, setProblems] = useState<ContestProblem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const fetchContestData = async () => {
      try {
        setIsLoading(true);
        // Fetch contest details
        const contestRes = await api.get(`/contests/${id}`);
        const contestData = contestRes.data.data;

        // Transform contest data
        const startTime = new Date(contestData.startTime);
        const endTime = new Date(contestData.endTime);
        const diffMs = endTime.getTime() - startTime.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        setContest({
          ...contestData,
          duration: `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`,
          status: contestData.status.toLowerCase(),
          participants: contestData.registeredUserCount || 0
        });

        // Fetch problems if registered or contest ended (backend logic usually handles this permission, but frontend should try)
        if (contestData.status !== 'UPCOMING' || contestData.isRegistered || user?.role === 'ADMIN') { // Simple check, backend is source of truth
          try {
            const problemsRes = await api.get(`/contests/${id}/problems`);
            setProblems(problemsRes.data.data.map((p: any) => ({
              id: p.id,
              title: p.title,
              points: p.maxScore || 100, // Assuming maxScore exists or default
              solved: p.userStatus === 'Solved',
              difficulty: p.difficulty, // Assuming difficulty exists
            })));
          } catch (err) {
            // Ignore error if problems can't be fetched (e.g. not authorized)
            console.log("Could not fetch problems (likely not started/registered)");
          }
        }

      } catch (error) {
        console.error("Failed to fetch contest details:", error);
        toast.error("Failed to load contest");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchContestData();
    }
  }, [id]);

  // Timer logic
  useEffect(() => {
    if (!contest || contest.status !== 'ongoing') return;

    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(contest.endTime);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("00:00:00");
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeRemaining(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [contest]);

  const handleRegister = async () => {
    try {
      await api.post(`/contests/${id}/register`);
      toast.success("Successfully registered!");
      // Reload page or re-fetch to update state
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to register");
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
      case "Easy":
        return "text-green-500";
      case "MEDIUM":
      case "Medium":
        return "text-yellow-500";
      case "HARD":
      case "Hard":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppNavbar />
        <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
          {/* Header Skeleton */}
          <div className="mb-8 space-y-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>

          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-8 w-32 mb-4" />
              {/* Problems List Skeleton */}
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b border-border/30">
                    <div className="flex items-center gap-4 w-full">
                      <Skeleton className="h-4 w-6" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-6 w-1/2" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Skeleton */}
            <div className="space-y-8">
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!contest) return <div className="min-h-screen bg-background"><AppNavbar /><div className="pt-24 text-center">Contest not found</div></div>;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
        {/* Contest Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link to="/contests" className="hover:text-foreground transition-colors">
              Contests
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span>{contest.title}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4">{contest.title}</h1>
          <p className="text-muted-foreground max-w-2xl">{contest.description}</p>
        </div>

        {/* Contest Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Duration</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{contest.duration}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Participants</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{contest.participants.toLocaleString()}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Trophy className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Problems</span>
            </div>
            <p className="text-xl font-semibold text-foreground">{problems.length > 0 ? problems.length : '-'}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Status</span>
            </div>
            <p className="text-xl font-semibold text-green-500 capitalize">{contest.status}</p>
          </div>
        </div>

        {/* Time Remaining Banner for ongoing contest */}
        {contest.status === "ongoing" && (
          <div className="mb-8 py-4 flex items-center justify-between border-b border-border/30">
            <div className="flex items-center gap-3">
              <span className="text-foreground font-medium">Time Remaining</span>
            </div>
            <span className="text-2xl font-mono font-bold text-primary">{timeRemaining}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Problems List */}
          <div className="lg:col-span-2">
            <div className="pb-4 mb-4">
              <h2 className="text-lg font-semibold text-foreground">Problems</h2>
            </div>

            {problems.length > 0 ? (
              <div className="divide-y divide-border/30">
                {problems.map((problem, index) => (
                  <Link
                    key={problem.id}
                    to={`/contest/${id}/problem/${problem.id}`}
                    className="flex items-center justify-between py-4 hover:bg-muted/5 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground font-mono text-sm w-6">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <div>
                        <h3 className="text-foreground font-medium group-hover:text-primary transition-colors">
                          {problem.title}
                        </h3>
                        <span className={`text-xs ${getDifficultyColor(problem.difficulty)}`}>
                          {problem.difficulty}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{problem.points} pts</span>
                      {problem.solved && (
                        <span className="text-green-500 text-sm">✓ Solved</span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border rounded-lg border-dashed border-border/50">
                <p className="text-muted-foreground">
                  {contest.status === 'upcoming'
                    ? "Problems will be visible when the contest starts."
                    : (contest.isRegistered ? "No problems found." : "Register to view problems.")}
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Rules */}
            <div className="mb-6">
              <h3 className="font-semibold text-foreground mb-3">Contest Rules</h3>
              <ul className="space-y-2">
                <li className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary">•</span>You can submit unlimited attempts for each problem</li>
                <li className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary">•</span>Penalty time is added for wrong submissions</li>
                <li className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary">•</span>Problems are ordered by difficulty</li>
                <li className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-primary">•</span>Contest ends exactly at the specified time</li>
              </ul>
            </div>

            {/* Actions */}
            <div>
              <h3 className="font-semibold text-foreground mb-3">Actions</h3>
              <div className="space-y-3">
                {contest.status === 'upcoming' ? (
                  contest.isRegistered ? (
                    <Button className="w-full" disabled>Registered</Button>
                  ) : (
                    <Button className="w-full" onClick={handleRegister}>Register for Contest</Button>
                  )
                ) : contest.status === 'ongoing' ? (
                  contest.isRegistered ? (
                    problems.length > 0 ? (
                      <Button className="w-full" asChild>
                        <Link to={`/contest/${id}/problem/${problems[0].id}`}>Start Contest</Link>
                      </Button>
                    ) : (
                      <Button className="w-full" disabled>No Problems Available</Button>
                    )
                  ) : (
                    <Button className="w-full" onClick={handleRegister}>Register to Enter</Button>
                  )
                ) : (
                  // Ended
                  <Button className="w-full" variant="outline" asChild>
                    <Link to={`/contest/${id}/leaderboard`}>View Final Leaderboard</Link>
                  </Button>
                )}

                <Button variant="outline" className="w-full" asChild>
                  <Link to={`/contest/${id}/leaderboard`}>View Leaderboard</Link>
                </Button>
              </div>
            </div>

            {/* Admin Controls */}
            {user?.role === 'ADMIN' && (
              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="font-semibold text-foreground mb-3">Admin Controls</h3>
                <div className="space-y-3">
                  <Input
                    placeholder="Problem ID (UUID)"
                    id="problemIdInput" // Simple way to get value without state overhead for now
                  />
                  <Button className="w-full" variant="secondary" onClick={async () => {
                    const input = document.getElementById('problemIdInput') as HTMLInputElement;
                    const problemId = input?.value;
                    if (!problemId) return toast.error("Problem ID required");
                    try {
                      await api.post("/contests/add-problem", { contestId: id, problemId });
                      toast.success("Problem added!");
                      window.location.reload();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || "Failed to add problem");
                    }
                  }}>
                    <Plus className="w-4 h-4 mr-2" /> Add Problem
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContestDetail;
