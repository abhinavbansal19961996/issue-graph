import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import graph from "../src/lib/example-graph.json";
import { workflows } from "../src/lib/landing-content";
import { exampleCommand, packageReleasePending, repositoryIsPublic } from "../src/lib/site";

describe("public launch proof", () => {
  test("uses a dated public capture with no private or external metadata", () => {
    expect(Number.isFinite(Date.parse(graph.capturedAt))).toBe(true);
    expect(graph.command).toBe(exampleCommand);
    expect(graph.nodes).toHaveLength(5);
    expect(graph.edges).toHaveLength(4);
    const allowed = new Set(["vercel-labs/portless", "vercel-labs/wterm"]);
    for (const node of graph.nodes) {
      expect(Object.keys(node).sort()).toEqual([
        "key",
        "number",
        "repository",
        "state",
        "title",
        "url",
      ]);
      expect(allowed.has(node.key.split("#")[0])).toBe(true);
      expect(new URL(node.url).origin).toBe("https://github.com");
    }
    for (const edge of graph.edges) {
      expect(edge.from).toBe(graph.seed);
      expect(graph.nodes.some((node) => node.key === edge.to)).toBe(true);
    }
  });

  test("keeps publication claims explicit and workflows on the canonical command", () => {
    expect(packageReleasePending).toBe(true);
    expect(repositoryIsPublic).toBe(false);
    for (const workflow of workflows) {
      expect(workflow.command.startsWith("issue-graph ")).toBe(true);
      expect(workflow.href.startsWith("/docs/")).toBe(true);
    }
  });

  test("ships a self-contained accessible README visual", () => {
    const svg = readFileSync(new URL("../public/issue-graph-demo.svg", import.meta.url), "utf8");
    expect(svg).toContain("<title");
    expect(svg).toContain("<desc");
    expect(svg).toContain('width="1000" height="500"');
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<foreignObject");
    expect(svg).not.toContain("href=");
  });
});
