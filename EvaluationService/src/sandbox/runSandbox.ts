import {
  createWorkspace,
  writeFile,
  cleanupWorkspace,
} from "./workspace";
import { compile } from "./compiler";
import { execute, Constraints } from "./executor";
import { compareOutput } from "./compareOutput";
import { languageConfig, Language } from "./languageConfig";

export interface Testcase {
  input: string;
  output: string;
}

export interface SandboxInput {
  code: string;
  language: Language;
  testcases: Testcase[];
  constraints: Constraints;
}

export interface SandboxResult {
  verdict: "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE";
  passed: number;
  total: number;
  timeTakenMs: number;
  error?: string;
  lastExecutedTestCase?: Testcase;
}

export function runSandbox({
  code,
  language,
  testcases,
  constraints,
}: SandboxInput): SandboxResult {
  const workspace = createWorkspace();
  const lang = languageConfig[language];
  const startTime = Date.now();

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

    let passed = 0;

    for (const tc of testcases) {
      const elapsed = Date.now() - startTime;
      const remainingTime =
        constraints.timeLimitMs - elapsed;

      if (remainingTime <= 0) {
        return {
          verdict: "TLE",
          passed,
          lastExecutedTestCase : tc,
          total: testcases.length,
          timeTakenMs: elapsed,
        };
      }

      writeFile(workspace, "input.txt", tc.input);

      let output: string;
      try {
        output = execute(   
          workspace,
          lang,
          constraints,
          remainingTime
        );
      } catch (err: any) {
        console.log(`Error in executing testcase due to run time error at ${JSON.stringify(tc)}`)
        return {
          verdict: err.message as any,
          passed,
          lastExecutedTestCase : tc,
          total: testcases.length,
          timeTakenMs: Date.now() - startTime,
        };
      }

      if (!compareOutput(output, tc.output)) {
        return {
          verdict: "WA",
          passed,
          lastExecutedTestCase : tc,
          total: testcases.length,
          timeTakenMs: Date.now() - startTime,
        };
      }

      passed++;
    }
    

    return {
      verdict: "AC",
      passed,
      total: testcases.length,
      timeTakenMs: Date.now() - startTime,
    };
  } finally {
    cleanupWorkspace(workspace);
  }
}
