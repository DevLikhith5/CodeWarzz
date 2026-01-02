import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AppNavbar } from "@/components/";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, Clock, Play, CheckCircle } from "lucide-react";
import CodeEditor from "@/components/CodeEditor";
import { useTheme } from "@/contexts/ThemeContext";
import api from "@/lib/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCodeEditorStore } from "@/stores/codeEditorStore";
import { Skeleton } from "@/components/ui/skeleton";

const defaultCode = ``;

const ContestProblem = () => {
  const { id, problemId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();


  const { saveCode, getSavedCode } = useCodeEditorStore();

  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [fullProblem, setFullProblem] = useState<any>(null);
  const [contestEndTime, setContestEndTime] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState("00:00:00");

  // Fetch submissions function
  const fetchSubmissions = async () => {
    if (!problemId || !id) return;
    try {
      setLoadingSubmissions(true);
      const res = await api.get(`/submissions?problemId=${problemId}&contestId=${id}&limit=20`);
      setSubmissions(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch contest submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    if (problemId) {
      fetchSubmissions();
    }
  }, [problemId]);

  const currentIndex = problems.findIndex(p => p.id === problemId);
  const isValidProblem = currentIndex !== -1;
  const currentProblem = isValidProblem ? problems[currentIndex] : null;

  const problemData = fullProblem ? {
    title: fullProblem.title,
    difficulty: fullProblem.difficulty.charAt(0) + fullProblem.difficulty.slice(1).toLowerCase(),
    points: currentProblem?.maxScore || 100, // maxScore usually from contest relation
    description: fullProblem.description || "No description provided.",
    examples: fullProblem.testcases?.filter((tc: any) => tc.isSample).map((tc: any) => ({
      input: tc.input,
      output: tc.output,
      explanation: tc.explanation
    })) || [],
    constraints: fullProblem.constraints || ["No constraints provided"],
    userStatus: currentProblem?.userStatus
  } : currentProblem ? {
    title: currentProblem.title,
    difficulty: currentProblem.difficulty.charAt(0) + currentProblem.difficulty.slice(1).toLowerCase(),
    points: currentProblem.maxScore || 100,
    description: "Loading...", // Show loading while fetching full details
    examples: [],
    constraints: [],
    userStatus: currentProblem.userStatus
  } : null;

  useEffect(() => {
    const fetchContestProblems = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/contests/${id}/problems`);
        const fetchedProblems = response.data.data;
        setProblems(fetchedProblems);
      } catch (error) {
        console.error("Failed to fetch contest problems", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchContestProblems();
    }
  }, [id]);

  useEffect(() => {
    const fetchContestDetails = async () => {
      try {
        const res = await api.get(`/contests/${id}`);
        if (res.data.data.endTime) {
          setContestEndTime(new Date(res.data.data.endTime));
        }
      } catch (err) {
        console.error("Failed to fetch contest details", err);
      }
    }
    if (id) fetchContestDetails();
  }, [id]);

  useEffect(() => {
    if (!contestEndTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = contestEndTime.getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeRemaining("ENDED");
        clearInterval(interval);
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [contestEndTime]);

  useEffect(() => {
    const fetchFullProblem = async () => {
      if (!currentProblem?.id) return;
      try {
        // Fetch by ID to get full details including description and testcases
        const res = await api.get(`/problems/${currentProblem.id}`);
        setFullProblem(res.data.data);
      } catch (err) {
        console.error("Failed to fetch full problem details", err);
      }
    }
    fetchFullProblem();
  }, [currentProblem?.id]);


  useEffect(() => {
    if (currentProblem) {
      const saved = getSavedCode(currentProblem.id, language);
      setCode(saved || "");
    }
  }, [currentProblem?.id, language, getSavedCode]);

  // Save code to store on change
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    if (currentProblem?.id) {
      saveCode(currentProblem.id, language, newCode);
    }
  };



  const handleSubmit = async () => {
    if (!code.trim()) return;
    try {
      setIsRunning(true);
      setOutput("Submitting...");

      const payload = {
        code,
        language,
        problemId: currentProblem.id,
        contestId: id
      };

      const response = await api.post("/submissions", payload);
      const submissionId = response.data.data.submissionId;

      pollSubmission(submissionId);
    } catch (error: any) {
      console.error("Submission failed:", error);
      setOutput(error.response?.data?.message || "Failed to submit code");
      setIsRunning(false);
    }
  };

  const pollSubmission = async (submissionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/submissions/${submissionId}`);
        const submission = response.data.data;

        if (submission.verdict !== "PENDING") {
          clearInterval(pollInterval);
          setIsRunning(false);

          let resultMessage = `Verdict: ${submission.verdict}`;
          if (submission.verdict === "AC") {
            resultMessage += `\n\nRuntime: ${submission.timeTakenMs}ms\nMemory: ${submission.memoryUsedMb}MB`;
          } else {
            resultMessage += `\n\nError: ${submission.errorMessage || "Check details"}`;
          }
          setOutput(resultMessage);
          // Refresh submissions list
          fetchSubmissions();
        } else {
          setOutput("Status: PENDING...");
        }
      } catch (error) {
        clearInterval(pollInterval);
        setIsRunning(false);
        setOutput("Error polling submission status");
      }
    }, 2000);
  };

  const getDifficultyBadgeStyles = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20";
      case "Medium":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20";
      case "Hard":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  };

  // Handle Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Nav Skeleton */}
        <div className="h-12 border-b border-border flex items-center px-4 justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel Skeleton */}
          <div className="w-[40%] border-r border-border p-6 space-y-6">
            <Skeleton className="h-8 w-3/4" />
            <div className="space-y-2 pb-8">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
          {/* Right Panel Skeleton */}
          <div className="flex-1 bg-muted/5 flex flex-col">
            <div className="h-10 border-b border-border flex items-center px-4 gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="flex-1" />
          </div>
        </div>
      </div>
    );
  }

  // Handle Invalid ID or Data
  if (!isValidProblem || !problemData) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppNavbar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {problems.length > 0 ? "Problem not found." : "No problems available."}
        </div>
      </div>
    );
  }

  // Calculate Next/Prev logic
  const hasNext = currentIndex < problems.length - 1;
  const hasPrev = currentIndex > 0;
  const nextProblemId = hasNext ? problems[currentIndex + 1].id : null;
  const prevProblemId = hasPrev ? problems[currentIndex - 1].id : null;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Contest Header Bar - Fixed Height */}
      <div className="h-12 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center px-4 justify-between shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            to={`/contest/${id}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Link>
          <span className="text-muted-foreground/50">|</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground font-medium truncate max-w-[200px] md:max-w-md">Problem {String.fromCharCode(65 + currentIndex)}: {problemData.title}</span>
            {(() => {
              let derivedStatus = problemData.userStatus;
              if (submissions.length > 0) {
                if (submissions.some(s => s.verdict === 'AC')) derivedStatus = 'Solved';
                else if (!derivedStatus || derivedStatus === 'Unsolved') derivedStatus = 'Attempted';
              }

              if (derivedStatus === 'Solved') return <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">Solved</span>;
              if (derivedStatus === 'Attempted') return <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium border border-yellow-500/20">Attempted</span>;
              return null;
            })()}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-primary" />
            <span className="font-mono font-medium text-primary">{timeRemaining}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={!hasPrev} className="h-8 px-2">
              <Link to={hasPrev ? `/contest/${id}/problem/${prevProblemId}` : "#"}>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={!hasNext} className="h-8 px-2">
              <Link to={hasNext ? `/contest/${id}/problem/${nextProblemId}` : "#"}>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Flex Grow */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full border-t border-border/10">
          {/* Left Panel - Problem Description */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="flex flex-col h-full bg-card/10">
              {/* Tabs */}
              <div className="flex border-b border-border/30 bg-muted/20 shrink-0">
                <button
                  onClick={() => setActiveTab("description")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "description"
                    ? "text-foreground border-b-2 border-primary bg-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                >
                  Description
                </button>
                <button
                  onClick={() => setActiveTab("submissions")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "submissions"
                    ? "text-foreground border-b-2 border-primary bg-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    }`}
                >
                  Submissions
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {activeTab === "description" && (
                  <div className="space-y-8 max-w-3xl mx-auto">
                    {/* Title & Difficulty */}
                    <div>
                      <h1 className="text-2xl font-bold text-foreground mb-3">{problemData.title}</h1>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center justify-center ${getDifficultyBadgeStyles(problemData.difficulty)}`}>
                          {problemData.difficulty}
                        </span>
                        <span className="text-sm text-muted-foreground">{problemData.points} points</span>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: problemData.description.replace(/\n/g, '<br/>') }} />
                    </div>

                    {/* Examples */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 bg-primary rounded-full" /> Examples
                      </h3>
                      <div className="space-y-4">
                        {problemData.examples.map((example, index) => (
                          <div key={index} className="rounded-lg border border-border/40 bg-muted/10 overflow-hidden">
                            <div className="p-3 bg-muted/30 border-b border-border/30">
                              <span className="text-xs font-mono text-muted-foreground">Example {index + 1}</span>
                            </div>
                            <div className="p-4 space-y-3">
                              <div>
                                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Input</span>
                                <code className="block p-2 rounded bg-background border border-border/30 text-sm font-mono text-foreground">{example.input}</code>
                              </div>
                              <div>
                                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Output</span>
                                <code className="block p-2 rounded bg-background border border-border/30 text-sm font-mono text-foreground">{example.output}</code>
                              </div>
                              {example.explanation && (
                                <div>
                                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Explanation</span>
                                  <p className="text-sm text-muted-foreground">{example.explanation}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Constraints */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 bg-primary rounded-full" /> Constraints
                      </h3>
                      <ul className="grid grid-cols-1 gap-2">
                        {problemData.constraints.map((constraint, index) => (
                          <li key={index} className="text-sm text-muted-foreground font-mono bg-muted/10 p-2 rounded border border-border/30 flex items-start gap-2">
                            <span className="text-primary mt-1">•</span> {constraint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === "submissions" && (
                  <div className="space-y-4">
                    {activeTab === "submissions" && !submissions.length && !loadingSubmissions && (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
                        <div className="p-4 rounded-full bg-muted/20">
                          <Clock className="w-6 h-6 opacity-50" />
                        </div>
                        <p>No submissions yet</p>
                      </div>
                    )}

                    {loadingSubmissions && (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="p-3 border border-border/40 rounded-lg flex justify-between items-center">
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                            <div className="flex gap-4">
                              <Skeleton className="h-4 w-12" />
                              <Skeleton className="h-4 w-12" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {submissions.map((sub: any) => (
                        <div key={sub.id} className="bg-card border border-border/40 p-3 rounded-lg flex items-center justify-between hover:bg-muted/10 transition-colors">
                          <div className="flex flex-col gap-1">
                            <div className={`text-sm font-bold ${sub.verdict === 'AC' ? 'text-green-500' : 'text-red-500'}`}>
                              {sub.verdict === 'AC' ? 'Accepted' :
                                sub.verdict === 'WA' ? 'Wrong Answer' :
                                  sub.verdict === 'TLE' ? 'Time Limit Exceeded' :
                                    sub.verdict === 'MLE' ? 'Memory Limit Exceeded' :
                                      sub.verdict === 'CE' ? 'Compilation Error' :
                                        sub.verdict === 'RE' ? 'Runtime Error' : sub.verdict}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono">
                              {new Date(sub.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                            <span>{sub.timeTakenMs}ms</span>
                            <span>{sub.memoryUsedMb || 0}MB</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="bg-border/20 hover:bg-primary/50 transition-colors w-1.5" />

          {/* Right Panel - Code Editor & Output */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col overflow-hidden">
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={70} minSize={30}>
                  <div className="flex flex-col h-full bg-background dark:bg-[#1e1e1e]">
                    {/* Editor Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border dark:border-[#2d2d2d] bg-background dark:bg-[#1e1e1e] shrink-0">
                      <div className="flex items-center gap-2">
                        <Select value={language} onValueChange={setLanguage}>
                          <SelectTrigger className="w-[140px] h-7 text-xs bg-background dark:bg-[#2d2d2d] border-border dark:border-[#3e3e3e] text-foreground dark:text-gray-300">
                            <SelectValue placeholder="Language" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cpp">C++</SelectItem>
                            <SelectItem value="java">Java</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="go">Go</SelectItem>
                            <SelectItem value="rust">Rust</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSubmit}
                          disabled={isRunning}
                          className="h-7 text-xs"
                        >
                          Submit
                        </Button>
                      </div>
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1 relative">
                      <CodeEditor
                        language={language}
                        value={code}
                        onChange={handleCodeChange}
                        onMount={(editor, monaco) => {
                          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
                            handleSubmit();
                          });
                        }}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-border/20 dark:bg-[#2d2d2d] hover:bg-primary/50 transition-colors h-1.5" />

                <ResizablePanel defaultSize={30} minSize={10}>
                  {/* Output Panel */}
                  <div className="h-full bg-background dark:bg-[#1e1e1e] flex flex-col min-h-0 border-t border-border dark:border-[#2d2d2d]">
                    <div className="px-4 py-2 border-b border-border dark:border-[#2d2d2d] flex items-center justify-between shrink-0 bg-muted/30 dark:bg-[#252526]">
                      <span className="text-xs font-semibold text-muted-foreground dark:text-gray-400 uppercase tracking-wider">Console Output</span>
                      {output && (
                        <button onClick={() => setOutput("")} className="text-[10px] text-muted-foreground hover:text-foreground dark:text-gray-500 dark:hover:text-gray-300 uppercase">Clear</button>
                      )}
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto font-mono text-sm">
                      {isRunning ? (
                        <div className="flex items-center gap-2 text-muted-foreground dark:text-gray-400">
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Running test cases...
                        </div>
                      ) : output ? (
                        <pre className="whitespace-pre-wrap text-foreground dark:text-gray-300 leading-relaxed font-mono text-xs">{output}</pre>
                      ) : (
                        <div className="text-muted-foreground dark:text-gray-600 italic text-xs">Run your code to see output here...</div>
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

export default ContestProblem;
