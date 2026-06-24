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
	Input    string `json:"input"`
	Output   string `json:"output"`
	IsSample bool   `json:"isSample,omitempty"`
}

type Constraints struct {
	TimeLimitMs   int     `json:"timeLimitMs"`
	MemoryLimitMb int     `json:"memoryLimitMb"`
	CPULimit      float64 `json:"cpuLimit"`
}

type SandboxInput struct {
	Code        string      `json:"code"`
	Language    string      `json:"language"`
	Testcases   []Testcase  `json:"testcases"`
	Constraints Constraints `json:"constraints"`
	RunAll      bool        `json:"runAllTestcases"`
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

// normalizeOutput matches the TS compareOutput behaviour:
// trims, splits on newline, trims each line, collapses whitespace, drops empty lines.
func normalizeOutput(s string) []string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		// Collapse multiple whitespace into one
		fields := strings.Fields(trimmed)
		collapsed := strings.Join(fields, " ")
		if collapsed != "" {
			out = append(out, collapsed)
		}
	}
	return out
}

func compareOutput(actual, expected string) bool {
	a := normalizeOutput(actual)
	e := normalizeOutput(expected)
	if len(a) != len(e) {
		return false
	}
	for i := range a {
		if a[i] != e[i] {
			return false
		}
	}
	return true
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
	// Final verdict: pick the most severe encountered. Order: TLE > MLE > RE > WA > AC.
	verdict := "AC"
	severity := map[string]int{"AC": 0, "WA": 1, "RE": 2, "MLE": 3, "TLE": 4}
	mostSevere := 0
	passed := 0
	var firstFailedActual, firstFailedExpected string
	testcaseResults := make([]TestcaseResult, 0, len(sandboxInput.Testcases))

	for _, tc := range sandboxInput.Testcases {
		inputFile := filepath.Join(ws.Dir, "input.txt")
		if err := os.WriteFile(inputFile, []byte(tc.Input), 0644); err != nil {
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: "RE", Error: err.Error()})
			if severity["RE"] > mostSevere {
				mostSevere = severity["RE"]
				verdict = "RE"
			}
			if !sandboxInput.RunAll {
				return SandboxResult{Verdict: "RE", ErrorMessage: err.Error(), TimeTakenMs: time.Since(batchStart).Milliseconds()}
			}
			continue
		}

		output, err := Execute(ws, lang, sandboxInput.Constraints.TimeLimitMs, sandboxInput.Constraints.MemoryLimitMb, sandboxInput.Constraints.CPULimit, hostWorkspacesRoot)

		if err != nil {
			ver := err.Error()
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: ver, Error: err.Error()})
			if s, ok := severity[ver]; ok && s > mostSevere {
				mostSevere = s
				verdict = ver
			}
			if firstFailedActual == "" {
				firstFailedActual = output
				firstFailedExpected = tc.Output
			}
			if !sandboxInput.RunAll {
				return SandboxResult{Verdict: ver, TimeTakenMs: time.Since(batchStart).Milliseconds(), ActualOutput: output, ExpectedOutput: tc.Output}
			}
			continue
		}

		if compareOutput(output, tc.Output) {
			passed++
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: "AC"})
		} else {
			ver := "WA"
			testcaseResults = append(testcaseResults, TestcaseResult{Verdict: "WA", ActualOutput: strings.TrimSpace(output)})
			if severity[ver] > mostSevere {
				mostSevere = severity[ver]
				verdict = ver
			}
			if firstFailedActual == "" {
				firstFailedActual = output
				firstFailedExpected = tc.Output
			}
			if !sandboxInput.RunAll {
				return SandboxResult{
					Verdict:        "WA",
					Passed:         passed,
					Total:          len(sandboxInput.Testcases),
					TimeTakenMs:    time.Since(batchStart).Milliseconds(),
					ActualOutput:   strings.TrimSpace(output),
					ExpectedOutput: strings.TrimSpace(tc.Output),
				}
			}
		}
	}

	if mostSevere == 0 {
		verdict = "AC"
	}

	return SandboxResult{
		Verdict:         verdict,
		Passed:          passed,
		Total:           len(sandboxInput.Testcases),
		TimeTakenMs:     time.Since(batchStart).Milliseconds(),
		ActualOutput:    firstFailedActual,
		ExpectedOutput:  firstFailedExpected,
		TestcaseResults: testcaseResults,
	}
}
