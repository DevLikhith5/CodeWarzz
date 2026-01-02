import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthGuard from "@/features/auth/components/AuthGuard";
import Landing from "@/features/landing/routes/Landing";
import Auth from "@/features/auth/routes/Auth";
import AuthCallback from "@/features/auth/routes/AuthCallback";
import Dashboard from "@/features/dashboard/routes/Dashboard";
import Problems from "@/features/problems/routes/Problems";
import CreateProblem from "@/features/problems/routes/CreateProblem";
import Problem from "@/features/problems/routes/Problem";
import Profile from "@/features/profile/routes/Profile";
import Leaderboard from "@/features/leaderboard/routes/Leaderboard";
import Contests from "@/features/contests/routes/Contests";
import CreateContest from "@/features/contests/routes/CreateContest";
import ContestDetail from "@/features/contests/routes/ContestDetail";
import ContestProblem from "@/features/contests/routes/ContestProblem";
import ContestLeaderboard from "@/features/contests/components/ContestLeaderboard";
import ContestResults from "@/features/contests/routes/ContestResults";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Protected Routes */}
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/problems" element={<AuthGuard><Problems /></AuthGuard>} />
            <Route path="/problems/create" element={<AuthGuard><CreateProblem /></AuthGuard>} />
            <Route path="/problems/:id" element={<AuthGuard><Problem /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
            <Route path="/leaderboard" element={<AuthGuard><Leaderboard /></AuthGuard>} />
            <Route path="/contests" element={<AuthGuard><Contests /></AuthGuard>} />
            <Route path="/contests/create" element={<AuthGuard><CreateContest /></AuthGuard>} />
            <Route path="/contest/:id" element={<AuthGuard><ContestDetail /></AuthGuard>} />
            <Route path="/contest/:id/problem/:problemId" element={<AuthGuard><ContestProblem /></AuthGuard>} />
            <Route path="/contest/:id/leaderboard" element={<AuthGuard><ContestLeaderboard /></AuthGuard>} />
            <Route path="/contest/:id/results" element={<AuthGuard><ContestResults /></AuthGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
