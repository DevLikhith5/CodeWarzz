import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import Problems from "./pages/Problems";
import CreateProblem from "./pages/CreateProblem";
import Problem from "./pages/Problem";
import Profile from "./pages/Profile";
import Leaderboard from "./pages/Leaderboard";
import Contests from "./pages/Contests";
import ContestDetail from "./pages/ContestDetail";
import ContestProblem from "./pages/ContestProblem";
import ContestLeaderboard from "./pages/ContestLeaderboard";
import ContestResults from "./pages/ContestResults";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
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
