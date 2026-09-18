import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { testUrl } from "./test-url";

const url = testUrl();
const minimum = Number(process.env.DOCS_AUDIT_MIN_SCORE ?? "70");
if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) {
  throw new Error("DOCS_AUDIT_MIN_SCORE must be a number from 0 to 100.");
}
const child = spawn(
  "pnpm",
  ["exec", "agent-readability", "audit", url.toString(), "--min-score", String(minimum), "--json"],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
  },
);
const interrupt = () => child.kill("SIGINT");
const terminate = () => child.kill("SIGTERM");
process.once("SIGINT", interrupt);
process.once("SIGTERM", terminate);
try {
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve(code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1));
    });
  });
} finally {
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", terminate);
}
