import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import CodeEditor from "@/components/CodeEditor";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import api from "@/lib/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface TestCase {
  id: number;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  passed?: boolean;
  runtime?: string;
}

interface BackendProblem {
  id: string;
  title: string;
  description: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  testcases: {
    input: string;
    output: string;
    isSample: boolean;
  }[];
  constraints?: string[]; // Backend might not have this yet
}


const languages = [
  { id: "javascript", name: "JavaScript" },
  { id: "python", name: "Python" },
  { id: "cpp", name: "C++" },
  { id: "java", name: "Java" },
];

const defaultCode = `// Write your solution here


function solution() {
  // Your code
}
`;

const Problem = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [code, setCode] = useState(defaultCode);
  const [language, setLanguage] = useState("javascript");
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"description" | "submissions">("description");
  const [bottomTab, setBottomTab] = useState<"testcases" | "results" | "submission">("testcases");
  const [testResults, setTestResults] = useState<TestCase[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState(0);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/problems/${id}`);
        console.log("API Response:", response);
        const data = response.data.data || response.data; // Handle different response wrappers

        console.log("Fetched problem data:", data);

        if (!data) {
          throw new Error("No data received");
        }

        // Map backend data to frontend structure
        const mappedProblem = {
          ...data,
          difficulty: data.difficulty ? (data.difficulty.charAt(0) + data.difficulty.slice(1).toLowerCase()) : "Medium",
          examples: data.testcases?.filter((tc: any) => tc.isSample).map((tc: any, index: number) => ({
            input: tc.input,
            output: tc.output,
            explanation: tc.explanation || `Example ${index + 1}`
          })) || [],
          constraints: data.constraints && data.constraints.length > 0 ? data.constraints : [
            `Time Limit: ${data.timeLimitMs || 2000}ms`,
            `Memory Limit: ${data.memoryLimitMb || 256}MB`,
            "1 <= input.length <= 10^5"
          ],
          testCases: data.testcases?.map((tc: any, index: number) => ({
            id: index + 1,
            input: tc.input,
            expectedOutput: tc.output,
            isSample: tc.isSample, // Keep track of sample status
            passed: false // Initialize state
          })) || []
        };

        console.log("Mapped Problem:", mappedProblem);
        setProblem(mappedProblem);
      } catch (err) {
        console.error("Failed to fetch problem:", err);
        setError("Failed to load problem");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProblem();
    }
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-foreground">Loading problem...</div>;
  }

  if (error || !problem) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-foreground">
        <h2 className="text-xl mb-4">{error || "Problem not found"}</h2>
        <Button onClick={() => navigate("/problems")}>Go Back</Button>
      </div>
    );
  }

  // Helper to extract numeric ID if needed, or useUUID
  const problemIdDisplay = problem.id.substring(0, 8); // simplified display
  // }, []);

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

  const handleRun = async () => {
    if (!problem) return;
    setIsRunning(true);
    setBottomTab("results");
    setTestResults([]); // Clear previous results

    // Filter only sample test cases for "Run"
    const sampleTestCases = problem.testCases?.filter((tc: any) => tc.isSample) || [];

    if (sampleTestCases.length === 0) {
      // Fallback if no samples marked, use first 2 or all
      // But ideally we should have samples.
      // For now preventing run of 0 cases
    }

    try {
      const payload = {
        code,
        language,
        problemId: problem.id,
        testcases: sampleTestCases.map((tc: any) => ({
          input: tc.input,
          output: tc.expectedOutput
        }))
      };

      const res = await api.post('/submissions/run', payload);
      const jobId = res.data.data.jobId;

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/submissions/run/${jobId}`);
          const statusData = statusRes.data.data;

          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(pollInterval);
            setIsRunning(false);

            if (statusData.status === 'completed' && statusData.result) {
              const runOutput = statusData.result;

              // Check for testcaseResults array in the new format
              if (runOutput.testcaseResults && Array.isArray(runOutput.testcaseResults)) {
                // Map results back to the *sample* test cases we sent
                const results = sampleTestCases.map((tc: any, index: number) => {
                  const caseResult = runOutput.testcaseResults[index];
                  if (caseResult) {
                    return {
                      ...tc,
                      actualOutput: caseResult.actualOutput,
                      passed: caseResult.verdict === 'AC',
                      runtime: runOutput.timeTakenMs ? `${Math.floor(runOutput.timeTakenMs / runOutput.total)} ms` : "0 ms",
                    };
                  }
                  return tc;
                });
                setTestResults(results);
              } else if (runOutput.results) {
                const results = sampleTestCases.map((tc: any, index: number) => {
                  const caseResult = runOutput.results ? runOutput.results[index] : null;
                  return {
                    ...tc,
                    actualOutput: caseResult?.stdout?.trim() || caseResult?.stderr?.trim() || "No output",
                    passed: caseResult?.status?.id === 3,
                    runtime: caseResult?.time ? `${Math.floor(caseResult.time * 1000)} ms` : "0 ms",
                  };
                });
                setTestResults(results);
              } else {
                if (runOutput.stderr) {
                  setTestResults(sampleTestCases.map((tc: any) => ({
                    ...tc,
                    actualOutput: runOutput.stderr,
                    passed: false,
                    runtime: "0 ms"
                  })));
                } else {
                  setTestResults(sampleTestCases.map((tc: any) => ({
                    ...tc,
                    actualOutput: runOutput.stdout || "No output",
                    passed: (runOutput.stdout || "").trim() === tc.expectedOutput.trim(),
                    runtime: "10 ms" // dummy
                  })));
                }
              }

            } else {
              // Failed job
              console.error("Job failed:", statusData.error);
              setTestResults(sampleTestCases.map((tc: any) => ({
                ...tc,
                actualOutput: `Error: ${statusData.error || "Unknown error"}`,
                passed: false
              })));
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
          clearInterval(pollInterval);
          setIsRunning(false);
        }
      }, 1000);

    } catch (err) {
      console.error("Run failed:", err);
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!problem) return;
    setIsRunning(true);
    setBottomTab("submission"); // Switch to submission tab
    setSubmissionResult(null); // Clear previous submission result

    try {
      const res = await api.post('/submissions', {
        code,
        language,
        problemId: problem.id
      });
      const submissionId = res.data.data.submissionId;

      const pollInterval = setInterval(async () => {
        try {
          const subRes = await api.get(`/submissions/${submissionId}`);
          const submission = subRes.data.data;

          if (submission.verdict !== 'PENDING') {
            clearInterval(pollInterval);
            setIsRunning(false);
            setSubmissionResult(submission); // Store full submission data
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsRunning(false);
        }
      }, 1000);

    } catch (err) {
      console.error("Submit failed:", err);
      setIsRunning(false);
    }
  };

  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <nav className="h-14 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link
            to="/problems"
            className="flex items-center gap-1 text-lg font-bold transition-all duration-300 hover:opacity-80 group"
          >
            <span className="text-muted-foreground group-hover:drop-shadow-[0_0_8px_hsl(var(--muted-foreground)/0.5)]">
              Code
            </span>
            <span className="text-primary group-hover:drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]">
              Warz
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">{problem.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRun} disabled={isRunning}>
            {isRunning ? "Running..." : "Run"}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isRunning}>
            {isRunning ? "Running..." : "Submit"}
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden h-full">
        <ResizablePanelGroup direction="horizontal" className="min-h-screen">
          {/* Left Panel - Problem Description */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full border-r border-border overflow-auto">
              {/* Tabs */}
              <div className="flex border-b border-border">
                <button
                  className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === "description"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                  onClick={() => setActiveTab("description")}
                >
                  Description
                </button>
                <button
                  className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === "submissions"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                  onClick={() => setActiveTab("submissions")}
                >
                  Submissions
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {activeTab === "description" && (
                  <>
                    <div className="mb-4">
                      <h1 className="text-2xl font-bold text-foreground mb-2">
                        {problem.title}
                      </h1>
                      <span className={`text-sm font-medium ${getDifficultyColor(problem.difficulty)}`}>
                        {problem.difficulty}
                      </span>
                    </div>

                    <p className="text-foreground mb-6 leading-relaxed">{problem.description}</p>

                    <div className="space-y-4 mb-6">
                      {problem.examples.map((example, index) => (
                        <div key={index} className="bg-card border border-border rounded-lg p-4">
                          <p className="text-sm font-medium text-foreground mb-2">Example {index + 1}:</p>
                          <div className="font-mono text-sm text-muted-foreground space-y-1">
                            <p><span className="text-foreground">Input:</span> {example.input}</p>
                            <p><span className="text-foreground">Output:</span> {example.output}</p>
                            {example.explanation && (
                              <p><span className="text-foreground">Explanation:</span> {example.explanation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">Constraints:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {problem.constraints.map((constraint, index) => (
                          <li key={index} className="text-sm text-muted-foreground font-mono">
                            {constraint}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {activeTab === "submissions" && (
                  <div className="text-center py-12 text-muted-foreground">
                    No submissions yet
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <ResizablePanelGroup direction="vertical">
                <ResizablePanel defaultSize={60} minSize={30}>
                  <div className="h-full flex flex-col">
                    {/* Language Selector */}
                    <div className="h-12 border-b border-border flex items-center px-4 gap-2">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        {languages.map((lang) => (
                          <option key={lang.id} value={lang.id}>
                            {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-h-0">
                      <CodeEditor
                        language={language}
                        value={code}
                        onChange={(value) => setCode(value || "")}
                      />
                    </div>
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                <ResizablePanel defaultSize={40} minSize={10}>
                  {/* Bottom Panel - Test Cases / Results */}
                  <div className="h-full border-t border-border flex flex-col">
                    {/* Bottom Tabs */}
                    <div className="flex border-b border-border bg-card/20">
                      <button
                        className={`px-4 py-2 text-sm font-medium transition-colors ${bottomTab === "testcases"
                          ? "text-foreground border-b-2 border-primary bg-card"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                        onClick={() => setBottomTab("testcases")}
                      >
                        Test Cases
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium transition-colors ${bottomTab === "results"
                          ? "text-foreground border-b-2 border-primary bg-card"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                        onClick={() => setBottomTab("results")}
                      >
                        Run Results
                      </button>
                      <button
                        className={`px-4 py-2 text-sm font-medium transition-colors ${bottomTab === "submission"
                          ? "text-foreground border-b-2 border-green-500 bg-card"
                          : "text-muted-foreground hover:text-foreground"
                          }`}
                        disabled={!submissionResult && !isRunning} // Only clickable if there is a result or running
                        onClick={() => setBottomTab("submission")}
                      >
                        Submission Result
                      </button>
                    </div>

                    {/* Bottom Content */}
                    <div className="flex-1 overflow-auto p-4">
                      {bottomTab === "testcases" && (
                        <div className="space-y-4">
                          {/* Only show sample cases here */}
                          <div className="flex gap-2">
                            {problem.testCases.filter((tc: any) => tc.isSample).map((tc: any, index: number) => (
                              <button
                                key={tc.id}
                                onClick={() => setSelectedTestCase(index)}
                                className={`px-3 py-1 text-sm rounded transition-colors ${selectedTestCase === index
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-card border border-border text-foreground hover:bg-muted/20"
                                  }`}
                              >
                                Case {index + 1}
                              </button>
                            ))}
                          </div>
                          {/* Show selected sample case */}
                          <div className="bg-card border border-border rounded-lg p-4 font-mono text-sm">
                            {/* Need to ensure we pick from the filtered list corresponding to the index */}
                            <p className="text-muted-foreground mb-2">Input:</p>
                            <p className="text-foreground">{problem.testCases.filter((tc: any) => tc.isSample)[selectedTestCase]?.input}</p>
                            <p className="text-muted-foreground mt-4 mb-2">Expected Output:</p>
                            <p className="text-foreground">{problem.testCases.filter((tc: any) => tc.isSample)[selectedTestCase]?.expectedOutput}</p>
                          </div>
                        </div>
                      )}

                      {bottomTab === "results" && (
                        <div className="space-y-4">
                          {isRunning ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                              Running Code...
                            </div>
                          ) : testResults.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                              <p>Run your code to see outputs.</p>
                            </div>
                          ) : (
                            <>
                              <div className="flex gap-2">
                                {testResults.map((result, index) => (
                                  <button
                                    key={result.id}
                                    onClick={() => setSelectedTestCase(index)}
                                    className={`px-3 py-1 text-sm rounded transition-colors flex items-center gap-2 ${selectedTestCase === index
                                      ? "bg-secondary text-secondary-foreground ring-1 ring-border"
                                      : "bg-card hover:bg-muted/50 text-muted-foreground"
                                      }`}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${result.passed ? "bg-green-500" : "bg-red-500"}`} />
                                    Case {index + 1}
                                  </button>
                                ))}
                              </div>

                              {testResults[selectedTestCase] && (
                                <div className="space-y-4 pt-4">
                                  <div className={`p-4 rounded-lg border-l-4 ${testResults[selectedTestCase].passed
                                    ? "border-l-green-500 pl-4 bg-transparent"
                                    : "border-l-red-500 pl-4 bg-transparent"}`}>
                                    <h3 className={`font-semibold ${testResults[selectedTestCase].passed ? "text-green-500" : "text-red-500"}`}>
                                      {testResults[selectedTestCase].passed ? "Accepted" : "Wrong Answer"}
                                    </h3>
                                  </div>

                                  <div className="font-mono text-sm space-y-6">
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Input</p>
                                      <div className="p-3 bg-muted/20 rounded text-foreground font-medium">
                                        {testResults[selectedTestCase].input}
                                      </div>
                                    </div>

                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Output</p>
                                      <div className="p-3 bg-muted/20 rounded text-foreground font-medium">
                                        {testResults[selectedTestCase].actualOutput}
                                      </div>
                                    </div>

                                    <div>
                                      <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Expected</p>
                                      <div className="p-3 bg-muted/20 rounded text-foreground font-medium">
                                        {testResults[selectedTestCase].expectedOutput}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {bottomTab === "submission" && (
                        <div className="h-full">
                          {isRunning ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                              <h3 className="text-lg font-medium text-foreground">Judging...</h3>
                              <p className="text-sm">Running against hidden test cases</p>
                            </div>
                          ) : submissionResult ? (
                            <div className="space-y-8 pt-4">
                              <div className={`flex flex-col gap-2 ${submissionResult.verdict === 'AC' ? "text-green-500" : "text-red-500"}`}>
                                <h2 className="text-3xl font-bold">
                                  {submissionResult.verdict === 'AC' ? "Accepted" :
                                    submissionResult.verdict === 'WA' ? "Wrong Answer" :
                                      submissionResult.verdict === 'TLE' ? "Time Limit Exceeded" :
                                        submissionResult.verdict === 'MLE' ? "Memory Limit Exceeded" :
                                          submissionResult.verdict === 'CE' ? "Compilation Error" :
                                            submissionResult.verdict === 'RE' ? "Runtime Error" : submissionResult.verdict}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                  {submissionResult.verdict === 'AC'
                                    ? "All test cases passed!"
                                    : "Check your logic and try again."}
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-8">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Runtime</p>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-foreground">{submissionResult.timeTakenMs} ms</span>
                                  </div>
                                  <p className="text-xs text-green-500 mt-1">Beats 85%</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Memory</p>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-foreground">{submissionResult.memoryUsedMb || 0} MB</span>
                                  </div>
                                  <p className="text-xs text-green-500 mt-1">Beats 92%</p>
                                </div>
                              </div>

                              {/* If WA, show failed case detail if available */}
                              {submissionResult.verdict !== 'AC' && submissionResult.failedInput && (
                                <div className="font-mono text-sm space-y-4 pt-4 border-t border-border/50">
                                  <div className="flex items-center gap-2 text-red-500 mb-4">
                                    <span className="font-bold">Last Executed Input</span>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Input</p>
                                    <div className="p-3 bg-muted/20 rounded text-foreground">
                                      {submissionResult.failedInput}
                                    </div>
                                  </div>
                                  {(submissionResult.failedOutput || submissionResult.failedExpected) && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Output</p>
                                        <div className="p-3 bg-muted/20 rounded text-foreground">
                                          {submissionResult.failedOutput || "N/A"}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Expected</p>
                                        <div className="p-3 bg-muted/20 rounded text-foreground">
                                          {submissionResult.failedExpected || "N/A"}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                              No submission data available
                            </div>
                          )}
                        </div>
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

export default Problem;
