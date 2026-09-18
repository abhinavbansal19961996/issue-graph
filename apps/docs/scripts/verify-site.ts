import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const port = Number(process.env.DOCS_TEST_PORT ?? "3419");
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("DOCS_TEST_PORT must be an integer from 1024 to 65535.");
}
const origin = `http://127.0.0.1:${port}`;
const cwd = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");

type ChildResult = { code: number | null; signal: NodeJS.Signals | null; error?: Error };

function launch(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
  let result: ChildResult | undefined;
  const done = new Promise<ChildResult>((resolve) => {
    child.once("error", (error) => {
      result = { code: null, signal: null, error };
      resolve(result);
    });
    child.once("close", (code, signal) => {
      result ??= { code, signal };
      resolve(result);
    });
  });
  return {
    child,
    done,
    get result() {
      return result;
    },
  };
}

type ManagedChild = ReturnType<typeof launch>;

async function stop(managed: ManagedChild | undefined) {
  if (!managed || managed.result) return;
  managed.child.kill("SIGTERM");
  await Promise.race([managed.done, delay(5000, undefined, { ref: false })]);
  if (!managed.result) managed.child.kill("SIGKILL");
  await managed.done;
}

function serverFailure(result: ChildResult): Error {
  return result.error ?? new Error(`Docs server exited with ${result.code ?? result.signal}.`);
}

const server = launch([next, "start", "--hostname", "127.0.0.1", "--port", String(port)]);
let tests: ManagedChild | undefined;
const cancellation = new AbortController();
let interruptedExitCode = 1;
const interrupt = () => {
  interruptedExitCode = 130;
  cancellation.abort();
};
const terminate = () => {
  interruptedExitCode = 143;
  cancellation.abort();
};
const interrupted = new Promise<undefined>((resolve) => {
  cancellation.signal.addEventListener("abort", () => resolve(undefined), { once: true });
});
process.on("SIGINT", interrupt);
process.on("SIGTERM", terminate);

try {
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline && !cancellation.signal.aborted) {
    if (server.result) throw serverFailure(server.result);
    try {
      const response = await fetch(`${origin}/docs`, {
        headers: { accept: "text/html" },
        signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(2000)]),
      });
      await response.arrayBuffer();
      ready = response.ok;
    } catch (error) {
      if (cancellation.signal.aborted) throw error;
    }
    if (server.result) throw serverFailure(server.result);
    if (ready) break;
    await delay(200, undefined, { signal: cancellation.signal });
  }
  if (cancellation.signal.aborted) throw new Error("Docs verification interrupted.");
  if (!ready) throw new Error("Docs server did not become ready.");
  tests = launch(["--import", "tsx", "scripts/test-routes.ts"], {
    ...process.env,
    DOCS_TEST_URL: origin,
    DOCS_TEST_PREVIEW: process.env.VERCEL_ENV === "preview" ? "1" : "0",
  });
  const result = await Promise.race([
    tests.done,
    server.done.then((result) => {
      throw serverFailure(result);
    }),
    interrupted,
  ]);
  if (!result) throw new Error("Docs verification interrupted.");
  if (result.error) throw result.error;
  process.exitCode = result.code ?? 1;
} catch (error) {
  if (!cancellation.signal.aborted) console.error(error);
  process.exitCode = cancellation.signal.aborted ? interruptedExitCode : 1;
} finally {
  try {
    await stop(tests);
  } finally {
    try {
      await stop(server);
    } finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      if (cancellation.signal.aborted) process.exitCode = interruptedExitCode;
    }
  }
}
