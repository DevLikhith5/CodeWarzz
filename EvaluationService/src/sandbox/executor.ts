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
  remainingTimeMs: number
): string {
  try {
    const output = execSync(
      `docker run --rm \
       --network none \
       --memory ${constraints.memoryLimitMb}m \
       --cpus ${constraints.cpuLimit} \
       --pids-limit 64 \
       -v ${workspace.dir}:/app \
       -w /app \
       ${lang.image} \
       sh -c "${lang.runCommand} < input.txt"`,
      {
        timeout: remainingTimeMs,
        stdio: "pipe",
      }
    );

    return output.toString().trim();
  } catch (err: any) {
    if (err.killed) throw new Error("TLE");
    if (err.status === 137) throw new Error("MLE");

    console.error("STDERR:", err.stderr?.toString());
    throw new Error("RE");
  }
}
