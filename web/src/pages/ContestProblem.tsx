import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { AppNavbar } from "@/components/app/AppNavbar";
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

const defaultCode = `function solution() {
    // Write your solution here
    
}`;

const ContestProblem = () => {
  const { id, problemId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState(defaultCode);
  const [language, setLanguage] = useState("javascript");
  const [output, setOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [timeRemaining] = useState("01:12:45"); // This should ideally come from contest details

  // Determine current problem index dynamically based on UUID
  const currentIndex = problems.findIndex(p => p.id === problemId);
  const isValidProblem = currentIndex !== -1;
  const currentProblem = isValidProblem ? problems[currentIndex] : null;

  const problemData = currentProblem ? {
    title: currentProblem.title,
    difficulty: currentProblem.difficulty.charAt(0) + currentProblem.difficulty.slice(1).toLowerCase(),
    points: currentProblem.maxScore || 100, // Default to 100 if not provided
    description: currentProblem.description || "No description provided.",
    examples: currentProblem.testcases?.filter((tc: any) => tc.isSample).map((tc: any) => ({
      input: tc.input,
      output: tc.output,
      explanation: tc.explanation
    })) || [],
    constraints: currentProblem.constraints || ["No constraints provided"],
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
    if (currentProblem) {
      setCode(defaultCode);
    }
  }, [currentProblem?.id]); // Only reset code when problem ID changes

  const handleRun = async () => {
    if (!code.trim()) return;
    try {
      setIsRunning(true);
      setOutput("Running code...");

      const payload = {
        code,
        language,
        problemId: currentProblem.id,
        testcases: problemData.examples
      };

      const response = await api.post("/submissions/run", payload);
      const result = response.data.data;

      // Format the output
      if (result.success) {
        setOutput(`Output:\n${result.output}\n\nStatus: ${result.status}`);
      } else {
        setOutput(`Error:\n${result.error}\n\n${result.compilationError || ""}`);
      }
    } catch (error: any) {
      console.error("Run failed:", error);
      setOutput(error.response?.data?.message || "Failed to run code");
    } finally {
      setIsRunning(false);
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

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "text-green-500";
      case "Medium":
        return "text-yellow-500";
      case "Hard":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  // Handle Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AppNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-muted-foreground">Loading problem...</span>
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
          <span className="text-sm text-foreground font-medium truncate max-w-[200px] md:max-w-md">Problem {String.fromCharCode(65 + currentIndex)}: {problemData.title}</span>
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-muted ${getDifficultyColor(problemData.difficulty)}`}>
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
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <div className="p-4 rounded-full bg-muted/20">
                      <Clock className="w-6 h-6 opacity-50" />
                    </div>
                    <p>Submission history coming soon</p>
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
                  <div className="flex flex-col h-full bg-[#1e1e1e]">
                    {/* Editor Toolbar */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[#2d2d2d] bg-[#1e1e1e] shrink-0">
                      <div className="flex items-center gap-2">
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="bg-[#2d2d2d] text-xs text-gray-300 border border-[#3e3e3e] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 hover:bg-[#3e3e3e] transition-colors"
                        >
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                          <option value="cpp">C++</option>
                          <option value="java">Java</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleRun}
                          disabled={isRunning}
                          className="h-7 text-xs"
                        >
                          <Play className="w-3 h-3 mr-1.5" />
                          Run
                        </Button>
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
                        onChange={(value) => setCode(value || "")}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-[#2d2d2d] hover:bg-primary/50 transition-colors h-1.5" />

                <ResizablePanel defaultSize={30} minSize={10}>
                  {/* Output Panel */}
                  <div className="h-full bg-[#1e1e1e] flex flex-col min-h-0 border-t border-[#2d2d2d]">
                    <div className="px-4 py-2 border-b border-[#2d2d2d] flex items-center justify-between shrink-0 bg-[#252526]">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Console Output</span>
                      {output && (
                        <button onClick={() => setOutput("")} className="text-[10px] text-gray-500 hover:text-gray-300 uppercase">Clear</button>
                      )}
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto font-mono text-sm">
                      {isRunning ? (
                        <div className="flex items-center gap-2 text-gray-400">
                          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Running test cases...
                        </div>
                      ) : output ? (
                        <pre className="whitespace-pre-wrap text-gray-300 leading-relaxed font-mono text-xs">{output}</pre>
                      ) : (
                        <div className="text-gray-600 italic text-xs">Run your code to see output here...</div>
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
