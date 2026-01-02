import { execSync } from "child_process";
import { Workspace } from "./workspace";
import { LanguageConfig } from "./languageConfig";
import logger from "../config/logger.config";

import path from "path";

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
) {
  const startTime = Date.now();
  try {
    const timeLimitInSeconds = Math.ceil(constraints.timeLimitMs / 1000) + 2;
    const finalRunCommand = commandToRun || `${lang.runCommand} < input.txt`;

    // HOST_WORKSPACES_ROOT should be the HOST machine's absolute path to the temp_workspaces folder
    // This is required for Docker-in-Docker: the inner container mounts need to reference host paths
    const hostWorkspacesRoot = process.env.HOST_WORKSPACES_ROOT;

    // Get just the workspace folder name (e.g., "judge-c9ee82ed-8c54-4350-b609-42f0e133c237")
    const workspaceFolderName = path.basename(workspace.dir);

    logger.info(`[EXECUTOR] HOST_WORKSPACES_ROOT env var: '${hostWorkspacesRoot || 'NOT SET'}'`);
    logger.info(`[EXECUTOR] Internal Workspace Dir: '${workspace.dir}'`);
    logger.info(`[EXECUTOR] Workspace Folder Name: '${workspaceFolderName}'`);

    let volumePath: string;
    if (hostWorkspacesRoot) {
      // Running in Docker: use the host path for the mount
      volumePath = path.join(hostWorkspacesRoot, workspaceFolderName);
      logger.info(`[EXECUTOR] Using HOST volume path: '${volumePath}'`);
    } else {
      // Running locally (not in Docker): use the workspace dir directly
      volumePath = workspace.dir;
      logger.warn(`[EXECUTOR] HOST_WORKSPACES_ROOT not set! Using internal path: '${volumePath}'`);
    }

    const command = `docker run --rm \
       --network none \
       --memory ${constraints.memoryLimitMb}m \
       --cpus ${constraints.cpuLimit} \
       --pids-limit 64 \
       -v ${volumePath}:/app \
       -w /app \
       ${lang.image} \
       sh -c "timeout ${timeLimitInSeconds} ${finalRunCommand}"`;

    logger.debug(`[EXECUTOR] Command: ${command}`);

    const output = execSync(command,
      {
        timeout: 20000,
        stdio: "pipe",
      }
    );

    logger.debug(`[EXECUTOR] Finished in ${Date.now() - startTime}ms`);
    return output.toString().trim();
  } catch (err: any) {
    const duration = Date.now() - startTime;
    logger.error(`[EXECUTOR] Failed after ${duration}ms. Status: ${err.status}, Signal: ${err.signal}, Killed: ${err.killed}, Stderr: ${err.stderr?.toString()}`);

    if (err.killed || err.signal === "SIGTERM" || err.code === "ETIMEDOUT" || err.status === 124) {
      throw new Error("TLE");
    }
    if (err.status === 137) throw new Error("MLE");
    throw new Error("RE");
  }
}

