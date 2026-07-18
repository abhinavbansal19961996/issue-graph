import type { GraphNode, NodeKey } from "./types.js";

/**
 * Tag each non-seed node with a verdict. The load-bearing case is a
 * **superseded** open PR: it closes an issue that a different *merged* PR also
 * closes, so its work already shipped elsewhere and it is a candidate to close.
 */
export function classify(nodes: Map<NodeKey, GraphNode>): void {
  // issue -> PRs that close it, with each PR's state
  const closers = new Map<NodeKey, Array<{ pr: NodeKey; state: string }>>();
  for (const n of nodes.values()) {
    if (n.kind !== "PullRequest") continue;
    for (const e of n.edges) {
      if (e.via !== "closes") continue;
      const list = closers.get(e.to) ?? [];
      list.push({ pr: n.key, state: n.state });
      closers.set(e.to, list);
    }
  }

  for (const n of nodes.values()) {
    if (n.depth === 0) {
      n.verdict = "seed";
      // seeds still get flags below (competing / claims-no-link)
    } else if (n.kind === "PullRequest" && n.state === "OPEN") {
      let supersededBy: string | undefined;
      for (const e of n.edges) {
        if (e.via !== "closes") continue;
        const other = (closers.get(e.to) ?? []).find((c) => c.pr !== n.key && c.state === "MERGED");
        if (other) supersededBy = other.pr;
      }
      n.verdict = supersededBy
        ? `SUPERSEDED by merged ${supersededBy} — candidate to close (with credit)`
        : "OPEN PR — untriaged";
    } else if (n.kind === "Issue" && n.state === "OPEN") {
      const byMerged = [...nodes.values()].some(
        (p) =>
          p.kind === "PullRequest" && p.state === "MERGED" && p.edges.some((e) => e.to === n.key),
      );
      n.verdict = byMerged
        ? "OPEN issue — referenced by merged work, verify if resolved"
        : "OPEN issue — related, untracked";
    } else {
      n.verdict = n.state;
    }
  }

  flag(nodes, closers);
}

/**
 * Attach derived triage flags to nodes:
 * - **competing**: an issue closed by more than one OPEN PR (duplicate effort).
 * - **claims-close-no-link**: a PR body says `fixes #N` but has no structural
 *   closing link to #N, so merging it will *not* auto-close the issue.
 */
function flag(
  nodes: Map<NodeKey, GraphNode>,
  closers: Map<NodeKey, Array<{ pr: NodeKey; state: string }>>,
): void {
  const add = (n: GraphNode, f: string) => {
    n.flags ??= [];
    n.flags.push(f);
  };

  // competing open PRs per issue
  for (const [issue, list] of closers) {
    const open = list.filter((c) => c.state === "OPEN").map((c) => c.pr);
    if (open.length < 2) continue;
    for (const prKey of open) {
      const others = open.filter((p) => p !== prKey);
      const pr = nodes.get(prKey);
      if (pr) add(pr, `competes with ${others.join(", ")} to close ${issue}`);
    }
  }

  // a PR that claims to close an issue but has no structural closing link
  for (const n of nodes.values()) {
    if (n.kind !== "PullRequest" || !n.claimsClose?.length) continue;
    const structural = new Set(n.edges.filter((e) => e.via === "closes").map((e) => e.to));
    for (const claimed of n.claimsClose) {
      if (!structural.has(claimed))
        add(n, `claims to close ${claimed} but no closing link — merge won't auto-close it`);
    }
  }
}

/** Reverse attribution: fill each node's `mentionedBy` from incoming edge actors. */
export function fillMentionedBy(nodes: Map<NodeKey, GraphNode>): void {
  const inbound = new Map<NodeKey, Set<string>>();
  for (const n of nodes.values()) {
    for (const e of n.edges) {
      if (!e.by) continue;
      const set = inbound.get(e.to) ?? new Set<string>();
      set.add(e.by);
      inbound.set(e.to, set);
    }
  }
  for (const n of nodes.values()) n.mentionedBy = [...(inbound.get(n.key) ?? [])].sort();
}
