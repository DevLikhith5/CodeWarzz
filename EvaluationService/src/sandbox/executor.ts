import { execSync } from "child_process";
import { Workspace } from "./workspace";
import { LanguageConfig } from "./languageConfig";

export interface Constraints {
  timeLimitMs: number;
  memoryLimitMb: number;
  cpuLimit: number;
}

export function execute(
  workspace: Workspace,
  lang: LanguageConfig,
  constraints: Constraints,
  commandToRun?: string
): string {
  const startTime = Date.now();
  try {
    const timeLimitInSeconds = Math.ceil(constraints.timeLimitMs / 1000) + 2;
    const finalRunCommand = commandToRun || `${lang.runCommand} < input.txt`;

    const command = `docker run --rm \
       --network none \
       --memory ${constraints.memoryLimitMb}m \
       --cpus ${constraints.cpuLimit} \
       --pids-limit 64 \
       -v ${workspace.dir}:/app \
       -w /app \
       ${lang.image} \
       sh -c "timeout ${timeLimitInSeconds} ${finalRunCommand}"`;

    console.log(`[EXECUTOR] Command: ${command}`);

    const output = execSync(command,
      {
        timeout: 20000,
        stdio: "pipe",
      }
    );

    console.log(`[EXECUTOR] Finished in ${Date.now() - startTime}ms`);
    return output.toString().trim();
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[EXECUTOR] Failed after ${duration}ms. Status: ${err.status}, Signal: ${err.signal}, Killed: ${err.killed}, Stderr: ${err.stderr?.toString()}`);

    if (err.killed || err.signal === "SIGTERM" || err.code === "ETIMEDOUT" || err.status === 124) {
      throw new Error("TLE");
    }
    if (err.status === 137) throw new Error("MLE");
    throw new Error("RE");
  }
}
