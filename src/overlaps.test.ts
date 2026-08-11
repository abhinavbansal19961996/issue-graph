import { describe, expect, test } from "bun:test";
import { fileOverlaps } from "./overlaps.js";
import type { Edge, GraphNode, NodeKey, PullRequestMeta } from "./types.js";

function pr(key: NodeKey, files: string[], over: Partial<GraphNode> = {}): GraphNode {
  const [ownerRepo, num] = key.split("#");
  const [owner, repo] = ownerRepo.split("/");
  const meta: PullRequestMeta = {
    isDraft: false,
    reviewDecision: "",
    mergeable: "UNKNOWN",
    createdAt: "",
    mergedAt: "",
    updatedAt: "",
    additions: 0,
    deletions: 0,
    changedFiles: files.length,
    files,
  };
  return {
    key,
    owner,
    repo,
    number: Number(num),
    kind: "PullRequest",
    title: key,
    state: "OPEN",
    url: "",
    depth: 1,
    edges: [],
    externalLinks: [],
    fetched: true,
    pr: meta,
    ...over,
  };
}

const asMap = (ns: GraphNode[]) => new Map(ns.map((n) => [n.key, n]));
const closes = (to: NodeKey): Edge => ({ to, via: "closes" });

describe("fileOverlaps", () => {
  test("pairs open PRs that touch a shared file", () => {
    const nodes = asMap([
      pr("o/r#1", ["src/a.ts", "src/b.ts"]),
      pr("o/r#2", ["src/b.ts", "src/c.ts"]),
      pr("o/r#3", ["src/z.ts"]),
    ]);
    const ov = fileOverlaps(nodes);
    expect(ov).toHaveLength(1);
    expect(ov[0]).toMatchObject({ a: "o/r#1", b: "o/r#2", shared: ["src/b.ts"] });
  });

  test("marks a shared closing issue as a likely duplicate", () => {
    const nodes = asMap([
      pr("o/r#1", ["src/x.ts"], { edges: [closes("o/r#100")] }),
      pr("o/r#2", ["src/x.ts"], { edges: [closes("o/r#100")] }),
    ]);
    expect(fileOverlaps(nodes)[0].sharedIssue).toBe("o/r#100");
  });

  test("ignores merged/closed PRs and PRs with no files", () => {
    const nodes = asMap([
      pr("o/r#1", ["src/a.ts"], { state: "MERGED" }),
      pr("o/r#2", ["src/a.ts"]),
      pr("o/r#3", []),
    ]);
    expect(fileOverlaps(nodes)).toHaveLength(0);
  });

  test("ranks by overlap size, most shared first", () => {
    const nodes = asMap([
      pr("o/r#1", ["a", "b", "c"]),
      pr("o/r#2", ["a", "b", "c"]),
      pr("o/r#3", ["c", "d"]),
    ]);
    const ov = fileOverlaps(nodes);
    expect(ov[0].shared.length).toBeGreaterThanOrEqual(ov[ov.length - 1].shared.length);
    expect(ov[0]).toMatchObject({ a: "o/r#1", b: "o/r#2" });
  });
});
