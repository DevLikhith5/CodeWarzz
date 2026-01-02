import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppNavbar } from "@/components/layout/AppNavbar";

import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActivityHeatmap } from "@/features/profile/components/ActivityHeatmap";
import { PageTransition } from "@/components/layout/PageTransition";
import { StaggerContainer } from "@/components/common/StaggerContainer";
import { problemRepository, Problem } from "@/repositories/problem.repository";
import { userRepository, UserStats } from "@/repositories/user.repository";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";


const defaultDifficultyData = [
  { name: "Easy", value: 0, color: "#22c55e" },
  { name: "Medium", value: 0, color: "#eab308" },
  { name: "Hard", value: 0, color: "#ef4444" },
];

const generateHeatmapDataForYear = (year: number) => {
  const data: { date: Date; count: number }[] = [];

  return data;
};



const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#fff" className="text-2xl font-bold">
        {value}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#888" className="text-[10px] uppercase tracking-wider">
        {payload.name}
      </text>
    </g>
  );
};

const Dashboard = () => {
  const currentYear = new Date().getFullYear();


  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [recentProblems, setRecentProblems] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activityData, setActivityData] = useState<{ date: string; count: number }[]>([]);
  const [lastProblem, setLastProblem] = useState<{ id: string; slug: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {

        const problemsResponse = await problemRepository.getProblems(1, 4);
        const formattedProblems = problemsResponse.data.map((p) => {
          let statusString = "Unsolved";
          //@ts-ignore
          if (p?.userStatus === "Solved" || p?.userStatus === "AC") statusString = "Solved";
          //@ts-ignore
          else if (p?.userStatus) statusString = "Attempted";

          return {
            id: p.id,
            title: p.title,
            difficulty: p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1).toLowerCase(),
            status: statusString,
            slug: p.slug
          };
        });
        setRecentProblems(formattedProblems);


        const stats = await userRepository.getStats();
        setUserStats(stats);
        const activity = await userRepository.getActivity();
        setActivityData(activity);

        const lastProblem = await userRepository.getLastAttemptedProblem();
        if (lastProblem) {
          setLastProblem({ id: lastProblem.id, slug: lastProblem.slug });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      }
    };
    fetchData();
  }, []);

  const difficultyData = useMemo(() => {
    if (!userStats) return defaultDifficultyData;
    return [
      { name: "Easy", value: userStats.solved.EASY, color: "#22c55e" },
      { name: "Medium", value: userStats.solved.MEDIUM, color: "#eab308" },
      { name: "Hard", value: userStats.solved.HARD, color: "#ef4444" },
    ];
  }, [userStats]);

  const heatmapDataRaw = useMemo(() => {
    if (activityData.length === 0) return generateHeatmapDataForYear(selectedYear);
    const mapped = activityData.map(a => ({
      date: new Date(a.date),
      count: a.count
    })).filter(d => d.date.getFullYear() === selectedYear);


    return mapped.length > 0 ? mapped : generateHeatmapDataForYear(selectedYear);
  }, [activityData, selectedYear]);



  const totalSubmissions = useMemo(() =>
    heatmapDataRaw.reduce((acc, d) => acc + d.count, 0),
    [heatmapDataRaw]
  );

  const totalSolved = difficultyData.reduce((acc, curr) => acc + curr.value, 0);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [heatmapDataRaw]);

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <PageTransition>
        <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Continue your coding journey</p>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8">
            {/* Pie Chart Card with Hover */}
            <div className="p-4 md:p-6 flex flex-col items-center justify-center">
              <div className="relative w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={difficultyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      activeIndex={activeIndex !== null ? activeIndex : undefined}
                      activeShape={renderActiveShape}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {difficultyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text - only show when not hovering */}
                {activeIndex === null && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-foreground">{totalSolved}</span>
                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Solved</span>
                  </div>
                )}
              </div>
              {/* Difficulty Legend */}
              <div className="flex gap-4 mt-4">
                {difficultyData.map((item, index) => (
                  <div
                    key={item.name}
                    className={`flex items-center gap-2 cursor-pointer transition-opacity ${activeIndex !== null && activeIndex !== index ? 'opacity-40' : 'opacity-100'}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground/70 font-medium">
                    Activity
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedYear(prev => prev - 1)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={selectedYear <= 2020}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-medium text-foreground min-w-[50px] text-center">
                      {selectedYear}
                    </span>
                    <button
                      onClick={() => setSelectedYear(prev => prev + 1)}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                      disabled={selectedYear >= currentYear}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                ref={scrollRef}
                className="overflow-x-auto"
              >
                <ActivityHeatmap
                  data={heatmapDataRaw}
                  year={selectedYear}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
            <Button asChild className="tap-scale">
              <Link to="/problems">Browse Problems</Link>
            </Button>
            <Button variant="outline" asChild className="tap-scale">
              <Link to={lastProblem ? `/problems/${lastProblem.id}` : "/problems"}>
                {lastProblem ? "Continue Last Problem" : "Start Solving"}
              </Link>
            </Button>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="p-4 border-b border-border/50">
              <h2 className="text-lg font-semibold text-foreground">Recent Problems</h2>
            </div>
            <div className="divide-y divide-border/30">
              <StaggerContainer>
                {recentProblems.map((problem) => (
                  <Link
                    key={problem.id}
                    to={`/problems/${problem.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors hover-lift"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-foreground font-medium">{problem.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${problem.difficulty === "Easy" ? "text-green-500" :
                        problem.difficulty === "Medium" ? "text-yellow-500" :
                          "text-red-500"
                        }`}>
                        {problem.difficulty}
                      </span>
                    </div>

                    <span className={`text-xs px-2 py-0.5 rounded ${problem.status === "Solved" ? "text-green-500" :
                      problem.status === "Attempted" ? "text-yellow-500" :
                        "text-muted-foreground"
                      }`}>
                      {problem.status}
                    </span>
                  </Link>
                ))}
              </StaggerContainer>
            </div>
          </div>
        </main>
      </PageTransition>

    </div >
  );
};

export default Dashboard;
