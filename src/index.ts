/**
 * The runtime-agnostic core: graph types, crawling, classification, ranking,
 * and rendering. Nothing here imports a Node builtin, so it bundles for any
 * runtime.
 *
 * The parts that do touch the machine are separate entry points, so that
 * importing the core never drags them in:
 *   gh-graph/transport/shell  — `gh` shell-out (needs node:child_process)
 *   gh-graph/transport/http   — fetch + token
 *   gh-graph/snapshot         — on-disk snapshots (needs node:fs)
 *   gh-graph/cluster          — shells out to a coding agent
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
