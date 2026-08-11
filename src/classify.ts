import type { GraphNode, NodeKey } from "./types.js";

export function isSupersededVerdict(verdict?: string): boolean {
  return (
    verdict?.startsWith("SUPERSEDED") === true ||
    verdict?.startsWith("POSSIBLY SUPERSEDED") === true
  );
}

/**
 * Tag each non-seed node with a verdict. The load-bearing case is a
 * **superseded** open PR: it closes an issue that a different *merged* PR also
 * closes, so its work already shipped elsewhere and it is a candidate to close.
 */
export function classify(nodes: Map<NodeKey, GraphNode>): void {
  // issue -> PRs that close it, with each PR's state
  const closers = new Map<NodeKey, Array<{ pr: NodeKey; state: string; mergedAt: string }>>();
  for (const n of nodes.values()) {
    if (n.kind !== "PullRequest") continue;
    for (const e of n.edges) {
      if (e.via !== "closes") continue;
      const list = closers.get(e.to) ?? [];
      list.push({ pr: n.key, state: n.state, mergedAt: n.pr?.mergedAt ?? "" });
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
      if (supersededBy) {
        n.verdict = `SUPERSEDED by merged ${supersededBy} — candidate to close (with credit)`;
      } else {
        const possible = possibleSuperseder(n, nodes, closers);
        n.verdict = possible
          ? `POSSIBLY SUPERSEDED by merged ${possible.pr} via closed issue ${possible.issue} — verify scope, then close with credit`
          : "OPEN PR — untriaged";
      }
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

function possibleSuperseder(
  openPr: GraphNode,
  nodes: Map<NodeKey, GraphNode>,
  closers: Map<NodeKey, Array<{ pr: NodeKey; state: string; mergedAt: string }>>,
): { pr: NodeKey; issue: NodeKey } | undefined {
  const openedAt = Date.parse(openPr.pr?.createdAt ?? "");
  if (!Number.isFinite(openedAt)) return undefined;
  const relatedIssues = new Set<NodeKey>();
  for (const e of openPr.edges) {
    if (e.via === "cross-ref" || e.via === "connected") relatedIssues.add(e.to);
  }
  for (const n of nodes.values()) {
    if (n.kind !== "Issue") continue;
    if (
      n.edges.some((e) => e.to === openPr.key && (e.via === "cross-ref" || e.via === "connected"))
    ) {
      relatedIssues.add(n.key);
    }
  }

  for (const issue of [...relatedIssues].sort()) {
    if (nodes.get(issue)?.state !== "CLOSED") continue;
    const merged = (closers.get(issue) ?? [])
      .filter(
        (c) =>
          c.pr !== openPr.key &&
          c.state === "MERGED" &&
          Number.isFinite(Date.parse(c.mergedAt)) &&
          Date.parse(c.mergedAt) >= openedAt,
      )
      .sort((a, b) => a.pr.localeCompare(b.pr))[0];
    if (merged) return { pr: merged.pr, issue };
  }
  return undefined;
}

/**
 * Attach derived triage flags to nodes:
 * - **competing**: an issue closed by more than one OPEN PR (duplicate effort).
 * - **claims-close-no-link**: a PR body says `fixes #N` but has no structural
 *   closing link to #N, so merging it will *not* auto-close the issue.
 */
function flag(
  nodes: Map<NodeKey, GraphNode>,
  closers: Map<NodeKey, Array<{ pr: NodeKey; state: string; mergedAt: string }>>,
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
