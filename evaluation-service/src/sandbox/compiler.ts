import { execSync } from "child_process";
import { Workspace } from "./workspace";
import { LanguageConfig } from "./languageConfig";
import logger from "../config/logger.config";

export function compile(
  workspace: Workspace,
  lang: LanguageConfig
) {
  if (!lang.compileCommand) return;

  logger.debug(`[COMPILER] Compiling code for ${lang.image}`);
  try {
    execSync(
      `docker run --rm \
       -v ${workspace.dir}:/app \
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

