/**
 * The runtime-agnostic core: graph types, crawling, classification, ranking,
 * and rendering. Nothing here imports a Node builtin, so it bundles for any
 * runtime.
 *
 * The parts that do touch the machine are separate entry points, so that
 * importing the core never drags them in:
 *   @vercel-labs/xref/transport/shell  — `gh` shell-out (needs node:child_process)
 *   @vercel-labs/xref/transport/http   — fetch + token
 *   @vercel-labs/xref/snapshot         — on-disk snapshots (needs node:fs)
 *   @vercel-labs/xref/cluster          — shells out to a coding agent
 */
export * from "./classify.js";
export * from "./crawl.js";
export * from "./github.js";
export * from "./html.js";
export * from "./overlaps.js";
export * from "./priority.js";
export * from "./refs.js";
export * from "./render.js";
export * from "./transport.js";
export * from "./types.js";
