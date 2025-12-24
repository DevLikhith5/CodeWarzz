import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export interface Workspace {
  id: string;
  dir: string;
}

export function createWorkspace(): Workspace {
  const id = crypto.randomUUID();
  const dir = path.join(os.tmpdir(), `judge-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  return { id, dir };
}

export function writeFile(
  workspace: Workspace,
  filename: string,
  content: string
) {
  fs.writeFileSync(path.join(workspace.dir, filename), content);
}

export function cleanupWorkspace(workspace: Workspace) {
  fs.rmSync(workspace.dir, { recursive: true, force: true });
}
