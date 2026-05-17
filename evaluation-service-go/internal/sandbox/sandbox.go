package sandbox

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"evaluation-service-go/pkg/logger"
)

type Testcase struct {
	Input  string `json:"input"`
	Output string `json:"output"`
}

type Constraints struct {
	TimeLimitMs  int     `json:"timeLimitMs"`
	MemoryLimitMb int    `json:"memoryLimitMb"`
	CPULimit     float64 `json:"cpuLimit"`
}

type SandboxInput struct {
	Code      string      `json:"code"`
	Language  string      `json:"language"`
	Testcases []Testcase  `json:"testcases"`
	Constraints Constraints `json:"constraints"`
	RunAll    bool        `json:"runAllTestcases"`
}

type TestcaseResult struct {
	Verdict      string `json:"verdict"`
	ActualOutput string `json:"actualOutput,omitempty"`
	Error        string `json:"error,omitempty"`
}

type SandboxResult struct {
	Verdict         string           `json:"verdict"`
	Passed          int              `json:"passed"`
	Total           int              `json:"total"`
	TimeTakenMs     int64            `json:"timeTakenMs"`
	ErrorMessage    string           `json:"errorMessage,omitempty"`
	ActualOutput    string           `json:"actualOutput,omitempty"`
	ExpectedOutput  string           `json:"expectedOutput,omitempty"`
	TestcaseResults []TestcaseResult `json:"testcaseResults,omitempty"`
}

func Run(sandboxInput SandboxInput, hostWorkspacesRoot string) SandboxResult {
	logger.Info("Starting sandbox execution", "language", sandboxInput.Language, "testcases", len(sandboxInput.Testcases))

	lang, ok := Languages[Language(sandboxInput.Language)]
	if !ok {
		return SandboxResult{Verdict: "CE", ErrorMessage: fmt.Sprintf("Unsupported language: %s", sandboxInput.Language)}
	}

	ws, err := CreateWorkspace()
	if err != nil {
		return SandboxResult{Verdict: "RE", ErrorMessage: err.Error()}
	}
	defer CleanupWorkspace(ws)

	if err := WriteFile(ws, lang.SourceFile, sandboxInput.Code); err != nil {
		return SandboxResult{Verdict: "RE", ErrorMessage: err.Error()}
	}

	if err := Compile(ws, lang, hostWorkspacesRoot); err != nil {
		return SandboxResult{Verdict: "CE", ErrorMessage: err.Error()}
	}

	batchStart := time.Now()
	var verdict string
	passed := 0
	testcaseResults := make([]TestcaseResult, 0, len(sandboxInput.Testcases))

	for i, tc := range sandboxInput.Testcases {
		inputFile := filepath.Join(ws.Dir, "input.txt")
		if err := os.WriteFile(inputFile, []byte(tc.Input), 0644); err != nil {
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: "RE", Error: err.Error()})
			if !sandboxInput.RunAll {
				return SandboxResult{Verdict: "RE", ErrorMessage: err.Error(), TimeTakenMs: time.Since(batchStart).Milliseconds()}
			}
			continue
		}

		output, err := Execute(ws, lang, sandboxInput.Constraints.TimeLimitMs, sandboxInput.Constraints.MemoryLimitMb, sandboxInput.Constraints.CPULimit, hostWorkspacesRoot)

		if err != nil {
			verdict = err.Error()
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: verdict, Error: err.Error()})
			if !sandboxInput.RunAll {
				return SandboxResult{Verdict: verdict, TimeTakenMs: time.Since(batchStart).Milliseconds()}
			}
			continue
		}

		actualOutput := strings.TrimSpace(output)
		expectedOutput := strings.TrimSpace(tc.Output)

		if actualOutput == expectedOutput {
			passed++
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: "AC"})
		} else {
			verdict = "WA"
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: "WA", ActualOutput: actualOutput})
			if !sandboxInput.RunAll {
				return SandboxResult{
					Verdict:        "WA",
					Passed:         passed,
					Total:          len(sandboxInput.Testcases),
					TimeTakenMs:    time.Since(batchStart).Milliseconds(),
					ActualOutput:   actualOutput,
					ExpectedOutput: expectedOutput,
				}
			}
		}
	}

	if verdict == "" {
		verdict = "AC"
	}

	return SandboxResult{
		Verdict:         verdict,
		Passed:          passed,
		Total:           len(sandboxInput.Testcases),
		TimeTakenMs:     time.Since(batchStart).Milliseconds(),
		TestcaseResults: testcaseResults,
	}
}
