import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { AppNavbar } from "@/components/app/AppNavbar";

import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActivityHeatmap } from "@/components/app/ActivityHeatmap";

const recentProblems = [
  { id: 1, title: "Two Sum", difficulty: "Easy", status: "Solved" },
  { id: 2, title: "Add Two Numbers", difficulty: "Medium", status: "Attempted" },
  { id: 3, title: "Longest Substring", difficulty: "Medium", status: "Solved" },
  { id: 4, title: "Median of Two Sorted Arrays", difficulty: "Hard", status: "Unsolved" },
];

const difficultyData = [
  { name: "Easy", value: 25, color: "#22c55e" },
  { name: "Medium", value: 14, color: "#eab308" },
  { name: "Hard", value: 3, color: "#ef4444" },
];

const generateHeatmapDataForYear = (year: number) => {
  const data: { date: Date; count: number }[] = [];


  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  // Start from Jan 1 of the year
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const seed = currentDate.getFullYear() * 10000 + currentDate.getMonth() * 100 + currentDate.getDate();
    const random = seededRandom(seed);

    let count = 0;
    if (random > 0.5) count = Math.floor(seededRandom(seed + 1) * 3) + 1;
    if (random > 0.75) count = Math.floor(seededRandom(seed + 2) * 4) + 3;
    if (random > 0.9) count = Math.floor(seededRandom(seed + 3) * 3) + 6;

    data.push({ date: new Date(currentDate), count });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return data;
};

// Custom active shape for pie chart hover
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

  const heatmapDataRaw = useMemo(() => generateHeatmapDataForYear(selectedYear), [selectedYear]);

  // ActivityHeatmap handles levels internally
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
            <Link to="/problems/1">Continue Last Problem</Link>
          </Button>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="p-4 border-b border-border/50">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border/30">
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
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
