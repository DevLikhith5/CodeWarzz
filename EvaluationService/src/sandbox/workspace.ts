import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface Workspace {
  id: string;
  dir: string;
}

export function createWorkspace(): Workspace {
  const id = crypto.randomUUID();
  const dir = path.join(process.cwd(), "temp_workspaces", `judge-${id}`);
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

export function readFile(workspace: Workspace, filename: string): string {
  return fs.readFileSync(path.join(workspace.dir, filename), "utf8");
}

export function cleanupWorkspace(workspace: Workspace) {
  fs.rmSync(workspace.dir, { recursive: true, force: true });
}
