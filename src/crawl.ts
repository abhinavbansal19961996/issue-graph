import type { FetchNode } from "./github.js";
import { fetchNode as defaultFetchNode } from "./github.js";
import type { CrawlOptions, CrawlResult, GraphNode, NodeKey, Seed } from "./types.js";

/**
 * Breadth-first crawl from one or more seeds. Same-repo references recurse to
 * `maxDepth`; cross-repo references are fetched one hop and not expanded. Two
 * guards bound the crawl: a node cap, and a hub guard that fetches but does not
 * expand a high-degree non-seed node (e.g. a tracking issue) so it cannot pull
 * the whole tracker. `fetch` is injectable so the crawl can be tested offline.
 */
export function crawl(
  seeds: Seed[],
  opts: CrawlOptions,
  fetch: FetchNode = defaultFetchNode,
): CrawlResult {
  const { maxDepth, maxNodes, hubThreshold, primaryRepo } = opts;
  const nodes = new Map<NodeKey, GraphNode>();
  const cappedOut = new Set<NodeKey>();
  const seedKeys = new Set(seeds.map((s) => `${s.owner}/${s.repo}#${s.number}`));
  const queue: Array<Seed & { depth: number }> = seeds.map((s) => ({ ...s, depth: 0 }));
  const sameRepo = (o: string, r: string) => o === primaryRepo.owner && r === primaryRepo.repo;

  while (queue.length) {
    const cur = queue.shift();
    if (!cur) break;
    const key = `${cur.owner}/${cur.repo}#${cur.number}`;
    if (nodes.has(key)) continue;
    if (nodes.size >= maxNodes) {
      cappedOut.add(key);
      continue;
    }

    const node = fetch(cur.owner, cur.repo, cur.number, cur.depth);
    nodes.set(key, node);
    if (cur.depth >= maxDepth) continue;

    // hub guard: fetch a high-degree non-seed node but do not expand it
    if (!seedKeys.has(key) && node.edges.length > hubThreshold) {
      node.hub = true;
      continue;
    }

    for (const edge of node.edges) {
      const m = edge.to.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
      if (!m || nodes.has(edge.to)) continue;
      const [, o, r, n] = m;
      queue.push({
        owner: o,
        repo: r,
        number: Number(n),
        depth: sameRepo(o, r) ? cur.depth + 1 : maxDepth, // cross-repo: one hop only
      });
    }
  }

  return { nodes, cappedOut };
}

/** Undirected connected components over the crawled nodes, largest first. */
export function components(nodes: Map<NodeKey, GraphNode>): NodeKey[][] {
  const parent = new Map<NodeKey, NodeKey>();
  const find = (x: NodeKey): NodeKey => {
    let root = x;
    while (parent.get(root) !== root) {
      const p = parent.get(root);
      if (p === undefined) break;
      parent.set(root, parent.get(p) ?? p);
      root = parent.get(root) ?? root;
    }
    return root;
  };
  const union = (a: NodeKey, b: NodeKey) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const k of nodes.keys()) parent.set(k, k);
  for (const node of nodes.values()) {
    for (const edge of node.edges) if (nodes.has(edge.to)) union(node.key, edge.to);
  }
  const groups = new Map<NodeKey, NodeKey[]>();
  for (const k of nodes.keys()) {
    const root = find(k);
    const g = groups.get(root) ?? [];
    g.push(k);
    groups.set(root, g);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}
