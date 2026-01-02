import { execSync } from "child_process";
import path from "path";
import { Workspace } from "./workspace";
import { LanguageConfig } from "./languageConfig";
import logger from "../config/logger.config";

export function compile(
  workspace: Workspace,
  lang: LanguageConfig
) {
  if (!lang.compileCommand) return;

  // Calculate the correct volume path (host path for Docker-in-Docker)
  const hostWorkspacesRoot = process.env.HOST_WORKSPACES_ROOT;
  const workspaceFolderName = path.basename(workspace.dir);

  let volumePath: string;
  if (hostWorkspacesRoot) {
    volumePath = path.join(hostWorkspacesRoot, workspaceFolderName);
    logger.debug(`[COMPILER] Using HOST volume path: '${volumePath}'`);
  } else {
    volumePath = workspace.dir;
    logger.warn(`[COMPILER] HOST_WORKSPACES_ROOT not set! Using internal path: '${volumePath}'`);
  }

  logger.debug(`[COMPILER] Compiling code for ${lang.image}`);
  try {
    execSync(
      `docker run --rm \
       -v ${volumePath}:/app \
       -w /app \
       ${lang.image} \
       ${lang.compileCommand}`,
      { stdio: "pipe" }
    );
    logger.debug(`[COMPILER] Compilation successful`);
  } catch (err: any) {
    const stderr = err.stderr?.toString();
    logger.warn(`[COMPILER] Compilation failed`, { stderr });
    throw new Error(
      stderr || "Compilation failed"
    );
  }
}

