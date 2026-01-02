import { useMemo, useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { StatCard } from "@/features/profile/components/StatCard";
import { ActivityHeatmap } from "@/features/profile/components/ActivityHeatmap";
import { useAuthStore } from "@/features/auth/stores/useAuthStore";
import { UserRepository, userRepository } from "@/repositories/user.repository";
import { PageTransition } from "@/components/layout/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";

const Profile = () => {
  const { user } = useAuthStore();


  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => userRepository.getProfile(),
  });


  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => userRepository.getActivity(),
  });

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());


  const activityData = useMemo(() => {
    if (!activity) return [];
    return activity.filter(a => new Date(a.date).getFullYear() === selectedYear);
  }, [activity, selectedYear]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [activityData]);

  const isLoading = isProfileLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNavbar />
        <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
          {/* Header Skeleton */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-8 text-center sm:text-left">
            <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-full" />
            <div className="space-y-2 flex flex-col items-center sm:items-start">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>

          {/* Stats Grid Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>

          {/* Heatmap Skeleton */}
          <div className="space-y-4">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-48" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </main>
      </div>
    );
  }

  const { username, email, createdAt } = profile?.user || user || { username: 'User', email: '', createdAt: '' };
  const initials = username?.slice(0, 2).toUpperCase() || 'kb';
  const joinedDate = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown';

  // Stats from profile response
  const solved = profile?.solved || { TOTAL: 0, EASY: 0, MEDIUM: 0, HARD: 0 };

  const handlePrevYear = () => setSelectedYear(prev => prev - 1);
  const handleNextYear = () => setSelectedYear(prev => prev + 1);
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <PageTransition>
        <main className="container mx-auto px-4 md:px-6 pt-24 pb-12">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-8 text-center sm:text-left">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/20 flex items-center justify-center text-2xl sm:text-3xl font-bold text-primary shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{username}</h1>
              <p className="text-muted-foreground mb-2">@{username}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
              <p className="text-sm text-muted-foreground mt-1">Member since {joinedDate}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
            <StatCard label="Problems Solved" value={solved.TOTAL} />
            <StatCard label="Easy" value={solved.EASY} accentColor="#22c55e" />
            <StatCard label="Medium" value={solved.MEDIUM} accentColor="#eab308" />
            <StatCard label="Hard" value={solved.HARD} accentColor="#ef4444" />
          </div>

          {/* Tags / Skills */}
          {profile?.tags && profile.tags.length > 0 && (
            <div className="mb-8">
              <div className="p-4 border-b border-border/50 mb-4">
                <h2 className="text-lg font-semibold text-foreground">Top Skills</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span key={tag.tag} className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm flex items-center gap-2">
                    {tag.tag}
                    <span className="text-xs opacity-70">x{tag.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity Heatmap */}
          <div className="mb-8 relative">
            <div className="sticky top-20 left-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 mb-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Activity</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevYear}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                  >
                    <span className="sr-only">Previous Year</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <span className="text-sm font-medium">{selectedYear}</span>
                  <button
                    onClick={handleNextYear}
                    disabled={selectedYear === currentYear}
                    className="p-1 hover:bg-muted rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next Year</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                {activityData.reduce((acc, curr) => acc + curr.count, 0)} submissions
              </span>
            </div>

            <div
              ref={scrollRef}
              className="p-0 overflow-x-auto"
            >
              <ActivityHeatmap
                data={activityData} 
                year={selectedYear}
              />
            </div>
          </div>
        </main>
      </PageTransition>
    </div>
  );
};

export default Profile;
