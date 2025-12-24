import { execSync } from "child_process";
import { Workspace } from "./workspace";
import { LanguageConfig } from "./languageConfig";

export function compile(
  workspace: Workspace,
  lang: LanguageConfig
) {
  if (!lang.compileCommand) return;

  try {
    execSync(
      `docker run --rm \
       -v ${workspace.dir}:/app \
       -w /app \
       ${lang.image} \
       ${lang.compileCommand}`,
      { stdio: "pipe" }
    );
  } catch (err: any) {
    throw new Error(
      err.stderr?.toString() || "Compilation failed"
    );
  }
}
