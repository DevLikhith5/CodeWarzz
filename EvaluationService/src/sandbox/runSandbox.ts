import {
  createWorkspace,
  writeFile,
  cleanupWorkspace,
} from "./workspace";
import { compile } from "./compiler";
import { execute, Constraints } from "./executor";
import { compareOutput } from "./compareOutput";
import { languageConfig, Language } from "./languageConfig";
import fs from "fs";
import path from "path";

export interface Testcase {
  input: string;
  output: string;
}

export interface SandboxInput {
  code: string;
  language: Language;
  testcases: Testcase[];
  constraints: Constraints;
  runAllTestcases?: boolean;
}

export interface SingleTestcaseResult {
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  verdict: "AC" | "WA" | "TLE" | "RE";
  error?: string;
}

export interface SandboxResult {
  verdict: "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE";
  passed: number;
  total: number;
  timeTakenMs: number;
  error?: string;
  actualOutput?: string;
  expectedOutput?: string;
  lastExecutedTestCase?: Testcase;
  testcaseResults?: SingleTestcaseResult[];
}

export async function runSandbox({
  code,
  language,
  testcases,
  constraints,
  runAllTestcases
}: SandboxInput): Promise<SandboxResult> {
  const workspace = createWorkspace();
  const lang = languageConfig[language];

  try {
    writeFile(workspace, lang.sourceFile, code);

    try {
      compile(workspace, lang);
    } catch (err: any) {
      return {
        verdict: "CE",
        passed: 0,
        total: testcases.length,
        timeTakenMs: 0,
        error: err.message,
      };
    }

    // Prepare batch execution
    testcases.forEach((tc, i) => {
      writeFile(workspace, `input_${i}.txt`, tc.input);
    });

    // Strategy: For Submit, we exit early on failure. For Run, we run ALL.
    const earlyExitLogic = runAllTestcases ? "" : "if [ $EXIT_CODE -ne 0 ]; then exit $EXIT_CODE; fi";
    const runnerContent = `#!/bin/sh
for i in $(seq 0 ${testcases.length - 1}); do
  ${lang.runCommand} < input_$i.txt > output_$i.txt 2> err_$i.txt
  EXIT_CODE=$?
  echo $EXIT_CODE > exit_$i.txt
  ${earlyExitLogic}
done`;
    writeFile(workspace, "runner.sh", runnerContent);

    const batchStartTime = Date.now();
    let batchVerdict: SandboxResult["verdict"] = "AC";
    let passed = 0;

    try {
      execute(workspace, lang, constraints, "sh runner.sh");
    } catch (err: any) {
      if (err.message === "TLE") {
        batchVerdict = "TLE";
      } else {
        batchVerdict = "RE";
      }
    }

    const totalTimeTakenMs = Date.now() - batchStartTime;
    const testcaseResults: SingleTestcaseResult[] = [];
    let firstFailedResult: Partial<SandboxResult> | null = null;

    // Analyze results
    for (let i = 0; i < testcases.length; i++) {
      const exitFile = path.join(workspace.dir, `exit_${i}.txt`);
      const outputFile = path.join(workspace.dir, `output_${i}.txt`);
      const errorFile = path.join(workspace.dir, `err_${i}.txt`);

      let tcVerdict: SingleTestcaseResult["verdict"] = "AC";
      let tcActual: string | undefined = undefined;
      let tcError: string | undefined = undefined;

      if (!fs.existsSync(exitFile)) {
        // This test case didn't run or was cut short by TLE (if we didn't run all)
        tcVerdict = batchVerdict === "AC" ? "RE" : batchVerdict;
      } else {
        const exitCode = parseInt(fs.readFileSync(exitFile, "utf8").trim());
        tcActual = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8").trim() : undefined;
        tcError = fs.existsSync(errorFile) ? fs.readFileSync(errorFile, "utf8") : undefined;

        if (exitCode !== 0) {
          tcVerdict = "RE";
        } else if (!compareOutput(tcActual || "", testcases[i].output)) {
          tcVerdict = "WA";
        }
      }

      const tcResult: SingleTestcaseResult = {
        input: testcases[i].input,
        expectedOutput: testcases[i].output,
        actualOutput: tcActual,
        verdict: tcVerdict,
        error: tcError
      };

      if (tcVerdict === "AC") {
        passed++;
      } else if (!firstFailedResult) {
        firstFailedResult = {
          verdict: tcVerdict,
          actualOutput: tcActual,
          expectedOutput: testcases[i].output,
          error: tcError,
          lastExecutedTestCase: testcases[i]
        };
      }

      testcaseResults.push(tcResult);

      // If NOT runAllTestcases and we failed, we should have already exited via the script, 
      // but let's break here for safety as well.
      if (!runAllTestcases && tcVerdict !== "AC") break;
    }

    return {
      verdict: firstFailedResult?.verdict || "AC",
      passed,
      total: testcases.length,
      timeTakenMs: totalTimeTakenMs,
      actualOutput: firstFailedResult?.actualOutput,
      expectedOutput: firstFailedResult?.expectedOutput,
      error: firstFailedResult?.error,
      lastExecutedTestCase: firstFailedResult?.lastExecutedTestCase,
      testcaseResults: runAllTestcases ? testcaseResults : undefined
    };
  } finally {
    cleanupWorkspace(workspace);
  }
}
