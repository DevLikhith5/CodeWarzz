import fs from "fs";
import path from "path";
import crypto from "crypto";
import logger from "../config/logger.config";

export interface Workspace {
  id: string;
  dir: string;
}

// Restrictive permissions so a local attacker (e.g. another user on a shared
// CI runner) cannot read the user's source code or swap the file between
// `writeFile` and the `docker run` (TOCTOU).
const WORKSPACE_DIR_MODE = 0o700;
const WORKSPACE_FILE_MODE = 0o600;

export function createWorkspace(): Workspace {
  const id = crypto.randomUUID();
  const dir = path.join(process.cwd(), "temp_workspaces", `judge-${id}`);
  // `mode` on mkdirSync is only applied to newly-created directories; existing
  // parents retain their existing perms. For our use case the parent
  // `temp_workspaces` is created at boot with restrictive perms.
  fs.mkdirSync(dir, { recursive: true, mode: WORKSPACE_DIR_MODE });
  // Explicitly chmod in case the directory already existed (mkdir's mode
  // option is a no-op for existing dirs).
  try {
    fs.chmodSync(dir, WORKSPACE_DIR_MODE);
  } catch {
    // best-effort; chmod can fail on Windows or in some sandboxes
  }
  logger.debug(`[WORKSPACE] Created workspace: ${dir}`);
  return { id, dir };
}

export function writeFile(
  workspace: Workspace,
  filename: string,
  content: string
) {
  const filepath = path.join(workspace.dir, filename);
  fs.writeFileSync(filepath, content, { mode: WORKSPACE_FILE_MODE });
  try {
    fs.chmodSync(filepath, WORKSPACE_FILE_MODE);
  } catch {
    // best-effort
  }
}

export function readFile(workspace: Workspace, filename: string): string {
  return fs.readFileSync(path.join(workspace.dir, filename), "utf8");
}

export function cleanupWorkspace(workspace: Workspace) {
  try {
    fs.rmSync(workspace.dir, { recursive: true, force: true });
  } catch (err: any) {
    // Cleanup must never throw — the original error is more important.
    logger.warn(`[WORKSPACE] Cleanup failed: ${workspace.dir}`, { error: err.message });
  }
  logger.debug(`[WORKSPACE] Cleaned up workspace: ${workspace.dir}`);
}
