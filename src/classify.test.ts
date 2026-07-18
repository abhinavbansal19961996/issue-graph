import { describe, expect, test } from "bun:test";
import { classify, fillMentionedBy } from "./classify.js";
import type { Edge, GraphNode, NodeKey } from "./types.js";

function node(key: NodeKey, over: Partial<GraphNode> = {}): GraphNode {
  const [ownerRepo, num] = key.split("#");
  const [owner, repo] = ownerRepo.split("/");
  return {
    key,
    owner,
    repo,
    number: Number(num),
    kind: "Issue",
    title: key,
    state: "OPEN",
    url: "",
    depth: 1,
    edges: [],
    externalLinks: [],
    fetched: true,
    ...over,
  };
}

const asMap = (ns: GraphNode[]) => new Map(ns.map((n) => [n.key, n]));
const closes = (to: NodeKey): Edge => ({ to, via: "closes" });

describe("classify", () => {
  test("flags an open PR as superseded when a merged PR closes the same issue", () => {
    const nodes = asMap([
      node("o/r#352", { kind: "PullRequest", state: "MERGED", edges: [closes("o/r#343")] }),
      node("o/r#349", { kind: "PullRequest", state: "OPEN", edges: [closes("o/r#343")] }),
      node("o/r#343", { state: "CLOSED" }),
    ]);
    classify(nodes);
    expect(nodes.get("o/r#349")?.verdict).toMatch(/^SUPERSEDED by merged o\/r#352/);
  });

  test("an unrelated open PR is untriaged, not superseded", () => {
    const nodes = asMap([
      node("o/r#500", { kind: "PullRequest", state: "OPEN", edges: [closes("o/r#501")] }),
      node("o/r#501", { state: "OPEN" }),
    ]);
    classify(nodes);
    expect(nodes.get("o/r#500")?.verdict).toBe("OPEN PR — untriaged");
  });

  test("depth-0 nodes are marked as seeds", () => {
    const nodes = asMap([node("o/r#1", { depth: 0 })]);
    classify(nodes);
    expect(nodes.get("o/r#1")?.verdict).toBe("seed");
  });

  test("flags two open PRs closing the same issue as competing", () => {
    const nodes = asMap([
      node("o/r#10", { kind: "PullRequest", state: "OPEN", edges: [closes("o/r#1")] }),
      node("o/r#11", { kind: "PullRequest", state: "OPEN", edges: [closes("o/r#1")] }),
      node("o/r#1"),
    ]);
    classify(nodes);
    expect(nodes.get("o/r#10")?.flags?.join()).toContain("competes with o/r#11");
    expect(nodes.get("o/r#11")?.flags?.join()).toContain("competes with o/r#10");
  });

  test("flags a PR that claims to close an issue with no structural link", () => {
    const nodes = asMap([
      node("o/r#20", {
        kind: "PullRequest",
        state: "OPEN",
        claimsClose: ["o/r#2"], // body says "fixes #2"
        edges: [{ to: "o/r#2", via: "text" }], // but only a text mention, no closes
      }),
      node("o/r#2"),
    ]);
    classify(nodes);
    expect(nodes.get("o/r#20")?.flags?.join()).toContain("no closing link");
  });

  test("does not flag when the closing claim has a structural link", () => {
    const nodes = asMap([
      node("o/r#30", {
        kind: "PullRequest",
        state: "OPEN",
        claimsClose: ["o/r#3"],
        edges: [closes("o/r#3")],
      }),
      node("o/r#3"),
    ]);
    classify(nodes);
    expect(nodes.get("o/r#30")?.flags ?? []).toEqual([]);
  });
});

describe("fillMentionedBy", () => {
  test("collects incoming edge actors, sorted and deduped", () => {
    const nodes = asMap([
      node("o/r#1", { edges: [{ to: "o/r#3", via: "text", by: "bob" }] }),
      node("o/r#2", { edges: [{ to: "o/r#3", via: "cross-ref", by: "alice" }] }),
      node("o/r#3"),
    ]);
    fillMentionedBy(nodes);
    expect(nodes.get("o/r#3")?.mentionedBy).toEqual(["alice", "bob"]);
    expect(nodes.get("o/r#1")?.mentionedBy).toEqual([]);
  });
});
