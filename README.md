# gh-graph

`gh-graph` finds the full reference graph around a GitHub pull request or issue. It follows comments, mentions, linked pull requests, cross-referenced issues, closing references, and external links across repositories.

Use it before you work on an issue or PR. It shows related work that a normal text search can miss.

The CLI crawls, classifies, attributes, and saves the graph. It can also generate a prompt for an agent to group related nodes by root cause.

## Install

You need [Bun](https://bun.sh) and an authenticated [`gh`](https://cli.github.com) CLI.

```bash
git clone <repo> gh-graph && cd gh-graph
bun install
bun link
```

`bun link` adds `gh-graph` to your `PATH`.

## Run a graph

```bash
gh-graph <url|number> --repo owner/repo [options]
gh-graph 352 --repo vercel-labs/portless
gh-graph https://github.com/vercel-labs/portless/pull/352
```

Survey related issues from multiple starting points:

```bash
gh-graph --seeds 297,343,352 --repo vercel-labs/portless
gh-graph --label tailscale --repo vercel-labs/portless
```

Rank the open nodes by discussion heat — most comments, participants, reactions, inbound references, and time open first. Useful for "fix the most impactful issues" triage instead of inbox zero:

```bash
gh-graph --label tailscale --repo vercel-labs/portless --prioritize
```

Generate a root-cause clustering prompt, or run it with a headless agent:

```bash
gh-graph 352 --repo vercel-labs/portless --cluster
gh-graph 352 --repo vercel-labs/portless --cluster-run claude
```

## Options

| Flag | Default | Description |
| --- | --- | --- |
| `--repo owner/repo` | none | Required when you use a bare number, `--seeds`, or `--label` |
| `--depth N` | `2` | Same-repository crawl depth. Cross-repository references are fetched one hop and not expanded |
| `--seeds a,b,c` | none | Starting points for a multi-seed graph. Output includes connected components |
| `--label L` | none | Use every open issue with this label as a starting point |
| `--max-nodes N` | `80` | Stop after this many nodes |
| `--hub-threshold N` | `12` | Fetch high-degree non-seed nodes, but do not expand them |
| `--prioritize` | off | Rank open nodes by discussion heat: `comments×3 + participants×2 + reactions×2 + inbound refs×2 + min(12, daysOpen/30)` |
| `--cluster` | off | Print a clustering prompt for the calling agent |
| `--cluster-run claude\|codex` | none | Run a headless agent to cluster the graph |
| `--json path` | none | Write the graph as JSON (includes `components` and `overlaps`) |
| `--html path` | none | Write a self-contained master–detail explorer (Geist-styled, no server) |
| `--clusters path` | none | JSON of agent-named clusters to group the explorer by; falls back to connected components |
| `--no-snapshot` | off | Do not save this run |

## Output

Each run produces:

- a node list with every reachable issue or pull request, its current state, author, referrers, and outgoing edges
- for each pull request, a triage summary: review decision, draft/conflicting state, `+adds/-dels across Nf`, and last-updated date (staleness)
- a "possible duplicate / overlapping PRs" section pairing open PRs that touch the same files — the objective duplication and merge-conflict signal
- derived flags on nodes: `competing` (more than one open PR closes an issue) and `claims-close-no-link` (a `fixes #N` that has no closing link, so a merge won't auto-close it)
- an orphan checklist that identifies open, superseded, competing, and flagged nodes, including pull requests that may be ready to close
- connected components in multi-seed mode, grouped by root-cause cluster
- with `--prioritize`, a triage-priority ranking of the open nodes by discussion heat — comment count, distinct participants, reactions, inbound references, and time open — with the raw signals printed next to each score so a human can override the order
- a diff from the previous snapshot, including new nodes, state changes, and new references

The `--json` file additionally includes the computed `components`, `overlaps`, and `priorities` so downstream tooling does not recompute them.

## HTML explorer

`--html report.html` writes a self-contained, Geist-styled **master–detail explorer** (no server, no build — just `open` it). The left pane is a filterable tree of connected components, or of agent-named clusters when you pass `--clusters clusters.json`. Selecting a node opens an inspector with its PR triage metadata, derived flags, verdict, a small typed **ego-graph** of its neighborhood, and its relationships grouped by kind (closes / closed by / overlaps / references). Node links deep-link via the URL hash.

The `--clusters` file is either an array of `{ label, root_cause?, members: [{ key, verdict? }] }`, or an object `{ clusters: [...], cleanup: [{ key?, text }] }` that also carries a **Cleanup** checklist. The explorer pins Cleanup as its default view: the actionable close/supersede/retest list with the person to credit, each line linking to its node. This is exactly the shape the `--cluster` triage step produces, so an agent can cluster the graph and feed the result — clusters and cleanup — straight back into the explorer.

## How it finds references

`gh-graph` uses two sources:

- text references in issue and pull request bodies and comments, including `#123`, `owner/repo#123`, and URLs
- structural references from the GitHub GraphQL API, including cross-references, connected events, and closing references

Structural references catch attached pull requests that never appear in the text. That prevents the tool from missing related work.

The CLI fetches each node's current state directly. It does not rely on a cross-reference event, which may be stale.

A node limit and hub limit prevent a deep crawl from pulling in an entire tracker. When the CLI skips expanding a hub, it reports a command you can use to start from that node.

Each node records its author and the accounts that referenced it. Each edge records the actor and date.

Runs are saved in `~/.gh-graph/`. A later run over the same starting points shows what changed.

With `--cluster`, the CLI prints a prompt and compact payload for the calling agent. The agent does the root-cause analysis in its own context. The CLI does not need an API key. `--cluster-run` can call a headless `claude` or `codex` process for unattended runs.

## Develop

```bash
bun test
bun run typecheck
bun run lint
```

## Use with Claude Code

The `gh-graph` Claude Code skill wraps this CLI. It lets an agent run the graph by intent and then cluster the result.
