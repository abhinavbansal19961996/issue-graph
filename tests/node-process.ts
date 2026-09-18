import { type SpawnOptionsWithoutStdio, spawn } from "node:child_process";

interface NodeResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export function runNode(
  args: string[],
  options: Pick<SpawnOptionsWithoutStdio, "cwd" | "env"> = {},
): Promise<NodeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", ...args], {
      cwd: new URL("../", import.meta.url),
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
