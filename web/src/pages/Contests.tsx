import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppNavbar } from "@/components/app/AppNavbar";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { toast } from "sonner";
interface Contest {
  id: number;
  title: string;
  startTime: string;
  duration: string;
  status: "upcoming" | "ongoing" | "ended";
  participants: number;
  isRegistered?: boolean;
}
const contestsData: Contest[] = [{
  id: 1,
  title: "Weekly Contest 378",
  startTime: "2024-01-21 10:30",
  duration: "1h 30m",
  status: "upcoming",
  participants: 0
}, {
  id: 2,
  title: "Biweekly Contest 121",
  startTime: "2024-01-20 14:30",
  duration: "1h 30m",
  status: "ongoing",
  participants: 12453
}, {
  id: 3,
  title: "Weekly Contest 377",
  startTime: "2024-01-14 10:30",
  duration: "1h 30m",
  status: "ended",
  participants: 28934
}, {
  id: 4,
  title: "Biweekly Contest 120",
  startTime: "2024-01-06 14:30",
  duration: "1h 30m",
  status: "ended",
  participants: 31245
}, {
  id: 5,
  title: "Weekly Contest 376",
  startTime: "2024-01-07 10:30",
  duration: "1h 30m",
  status: "ended",
  participants: 27689
}];
const Contests = () => {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [contests, setContests] = useState<Contest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchContests = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/contests");
      if (response.data?.data) {
        setContests(response.data.data.map((c: any) => ({
          id: c.id,
          title: c.title,
          startTime: new Date(c.startTime).toLocaleString(),
          duration: (() => {
            const start = new Date(c.startTime);
            const end = new Date(c.endTime);
            const diffMs = end.getTime() - start.getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`;
          })(),
          status: c.status.toLowerCase(),
          participants: c.registeredUserCount || 0,
          isRegistered: c.isRegistered
        })));
      }
    } catch (error) {
      console.error("Failed to fetch contests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const handleRegister = async (contestId: number) => {
    try {
      await api.post(`/contests/${contestId}/register`);
      toast.success("Successfully registered for contest!");
      fetchContests(); // Refresh list to update status
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to register");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "text-blue-400";
      case "ongoing":
        return "text-green-500";
      case "ended":
        return "text-muted-foreground";
      default:
        return "text-muted-foreground";
    }
  };

  const filteredContests = contests.filter(contest => {
    if (activeTab === "upcoming") {
      return contest.status === "upcoming" || contest.status === "ongoing";
    }
    return contest.status === "ended";
  });

  return <div className="min-h-screen bg-background">
    <AppNavbar />
    <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <Button variant={activeTab === "upcoming" ? "default" : "outline"} onClick={() => setActiveTab("upcoming")}>
          Upcoming
        </Button>
        <Button variant={activeTab === "past" ? "default" : "outline"} onClick={() => setActiveTab("past")}>
          Past Contests
        </Button>
      </div>

      {/* Contest List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-muted-foreground animate-pulse">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p>Loading contests...</p>
          </div>
        ) : (
          <>
            {filteredContests.map(contest => <div key={contest.id} className="p-4 md:p-6 border-b border-border/30 hover:bg-muted/5 transition-colors hover-lift">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-lg md:text-xl font-semibold text-foreground mb-2">
                    {contest.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 md:gap-6 text-sm text-muted-foreground">
                    <span>{contest.startTime}</span>
                    <span>Duration: {contest.duration}</span>
                    {contest.participants > 0 && <span>{contest.participants.toLocaleString()} participants</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                  <span className={`text-sm font-medium capitalize ${getStatusColor(contest.status)}`}>
                    {contest.status}
                  </span>
                  {contest.status === "upcoming" && (
                    contest.isRegistered ? (
                      <Button size="sm" variant="secondary" disabled>Registered</Button>
                    ) : (
                      <Button size="sm" className="tap-scale" onClick={() => handleRegister(contest.id)}>Register</Button>
                    )
                  )}
                  {contest.status === "ongoing" && (
                    contest.isRegistered ? (
                      <Button size="sm" className="tap-scale" asChild>
                        <Link to={`/contest/${contest.id}`}>Enter</Link>
                      </Button>
                    ) : (
                      <Button size="sm" className="tap-scale" onClick={() => handleRegister(contest.id)}>Register</Button>
                    )
                  )}
                  {contest.status === "ended" && <Button variant="outline" size="sm" className="tap-scale" asChild>
                    <Link to={`/contest/${contest.id}/results`}>View Results</Link>
                  </Button>}
                </div>
              </div>
            </div>)}

            {filteredContests.length === 0 && <div className="text-center py-12 text-muted-foreground">
              No contests found
            </div>}
          </>
        )}
      </div>
    </main>
  </div>;
};
export default Contests;