import { describe, expect, test } from "bun:test";
import { diffSnapshots } from "./snapshot.js";
import type { Snapshot } from "./types.js";

const snap = (ts: string, nodes: Snapshot["nodes"]): Snapshot => ({ ts, nodes });

describe("diffSnapshots", () => {
  test("reports no changes for identical snapshots", () => {
    const a = snap("t0", [{ key: "o/r#1", kind: "Issue", state: "OPEN", title: "x", edges: [] }]);
    const b = snap("t1", [{ key: "o/r#1", kind: "Issue", state: "OPEN", title: "x", edges: [] }]);
    expect(diffSnapshots(a, b)).toContain("no changes");
  });

  test("detects new nodes, state changes, and new edges with attribution", () => {
    const prev = snap("t0", [
      { key: "o/r#1", kind: "PullRequest", state: "OPEN", title: "pr", edges: [] },
    ]);
    const now = snap("t1", [
      {
        key: "o/r#1",
        kind: "PullRequest",
        state: "MERGED",
        title: "pr",
        edges: [{ to: "o/r#2", via: "closes", by: "railly" }],
      },
      { key: "o/r#2", kind: "Issue", state: "CLOSED", title: "issue", edges: [] },
    ]);
    const out = diffSnapshots(prev, now);
    expect(out).toContain("o/r#1: OPEN → MERGED");
    expect(out).toContain("### New nodes");
    expect(out).toContain("o/r#2");
    expect(out).toContain("o/r#1 —closes→ o/r#2 (by @railly)");
  });

  test("reports removed nodes", () => {
    const prev = snap("t0", [
      { key: "o/r#9", kind: "Issue", state: "OPEN", title: "gone", edges: [] },
    ]);
    const now = snap("t1", []);
    expect(diffSnapshots(prev, now)).toContain("No longer referenced");
  });
});
