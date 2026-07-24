#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { classify, fillMentionedBy } from "./classify.js";
import { clusterPayload, clusterPrompt, runAgent } from "./cluster.js";
import { components, crawl } from "./crawl.js";
import { labelSeeds, makeFetchNode } from "./github.js";
import { type ClustersConfig, renderHtml } from "./html.js";
import { fileOverlaps } from "./overlaps.js";
import { prioritize, renderPriority } from "./priority.js";
import { parseSeed } from "./refs.js";
import { render } from "./render.js";
import {
  diffSnapshots,
  listSnapshots,
  readSnapshot,
  snapshotDir,
  toSnapshot,
  writeSnapshot,
} from "./snapshot.js";
import type { GhTransport } from "./transport.js";
import { shellTransport } from "./transports/shell.js";
import type { Seed } from "./types.js";

const USAGE =
  "usage: xref <url|number|--seeds a,b,c|--label L> [--repo owner/repo] [--depth N] [--max-nodes N] [--hub-threshold N] [--prioritize] [--cluster] [--cluster-run claude|codex] [--json out.json] [--html out.html] [--no-snapshot]";

interface Args {
  seed: string;
  repo: string;
  depth: number;
  jsonOut: string;
  htmlOut: string;
  clustersFile: string;
  seedsCsv: string;
  label: string;
  maxNodes: number;
  hubThreshold: number;
  cluster: boolean;
  clusterRun: string;
  noSnapshot: boolean;
  prioritize: boolean;
}

export function parseArgs(argv: string[]): Args {
  const a: Args = {
    seed: "",
    repo: "",
    depth: 2,
    jsonOut: "",
    htmlOut: "",
    clustersFile: "",
    seedsCsv: "",
    label: "",
    maxNodes: 80,
    hubThreshold: 12,
    cluster: false,
    clusterRun: "",
    noSnapshot: false,
    prioritize: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--repo") a.repo = argv[++i];
    else if (arg === "--depth") a.depth = Number(argv[++i]);
    else if (arg === "--json") a.jsonOut = argv[++i];
    else if (arg === "--html") a.htmlOut = argv[++i];
    else if (arg === "--clusters") a.clustersFile = argv[++i];
    else if (arg === "--seeds") a.seedsCsv = argv[++i];
    else if (arg === "--label") a.label = argv[++i];
    else if (arg === "--max-nodes") a.maxNodes = Number(argv[++i]);
    else if (arg === "--hub-threshold") a.hubThreshold = Number(argv[++i]);
    else if (arg === "--prioritize") a.prioritize = true;
    else if (arg === "--cluster") a.cluster = true;
    else if (arg === "--cluster-run") {
      a.cluster = true;
      a.clusterRun = argv[++i];
    } else if (arg === "--no-snapshot") a.noSnapshot = true;
    else a.seed = arg;
  }
  return a;
}

async function resolveSeeds(a: Args, transport: GhTransport): Promise<Seed[]> {
  if (a.label) {
    if (!a.repo) throw new Error("--label needs --repo");
    const [owner, repo] = a.repo.split("/");
    const numbers = await labelSeeds(transport, a.repo, a.label);
    return numbers.map((number) => ({ owner, repo, number }));
  }
  if (a.seedsCsv) {
    if (!a.repo) throw new Error("--seeds needs --repo");
    const [owner, repo] = a.repo.split("/");
    return a.seedsCsv.split(",").map((s) => ({ owner, repo, number: Number(s.trim()) }));
  }
  return [parseSeed(a.seed, a.repo)];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error(USAGE);
    process.exit(1);
  }
  const args = parseArgs(argv);
  const transport = shellTransport();
  const seeds = await resolveSeeds(args, transport);
  if (!seeds.length) {
    console.error("no seeds resolved");
    process.exit(1);
  }

  const primary = { owner: seeds[0].owner, repo: seeds[0].repo };
  const multi = seeds.length > 1;
  process.stderr.write(
    `crawling ${seeds.length} seed(s) in ${primary.owner}/${primary.repo} (depth ${args.depth}, max ${args.maxNodes} nodes, hub>${args.hubThreshold})\n`,
  );

  const { nodes, cappedOut } = await crawl(
    seeds,
    {
      maxDepth: args.depth,
      maxNodes: args.maxNodes,
      hubThreshold: args.hubThreshold,
      primaryRepo: primary,
    },
    makeFetchNode(transport),
  );
  classify(nodes);
  fillMentionedBy(nodes);

  const seedKeys = seeds.map((s) => `${s.owner}/${s.repo}#${s.number}`);
  let md = render(nodes, seedKeys, multi);

  const priorities = prioritize(nodes, new Date());
  if (args.prioritize) md += renderPriority(priorities);

  if (cappedOut.size) {
    md += `\n## Not crawled (node cap ${args.maxNodes} reached): ${cappedOut.size}\n\n`;
    md += `${[...cappedOut]
      .sort()
      .map((k) => `- ${k}`)
      .join("\n")}\n`;
  }

  // hub auto-suggest: each unexpanded hub becomes a one-command re-seed
  const hubs = [...nodes.values()].filter((n) => n.hub);
  if (hubs.length) {
    md += "\n## Hubs not expanded — re-seed to explore\n\n";
    for (const h of hubs) {
      md += `- ${h.key} (${h.edges.length} refs) → \`xref ${h.number} --repo ${h.owner}/${h.repo} --depth 1\`\n`;
    }
  }

  // temporal snapshot + diff
  const now = new Date().toISOString();
  const dir = snapshotDir(primary.owner, primary.repo, seedKeys);
  const prevFiles = listSnapshots(dir);
  const snap = toSnapshot(nodes, now);
  if (prevFiles.length) {
    const prev = readSnapshot(`${dir}/${prevFiles[prevFiles.length - 1]}`);
    if (prev) md += diffSnapshots(prev, snap);
  } else {
    md += "\n## Snapshot\n\n- first snapshot for this seed; re-run later to see changes\n";
  }

  console.log(md);

  if (args.cluster) {
    const prompt = clusterPrompt(
      `${primary.owner}/${primary.repo}`,
      clusterPayload(nodes, seedKeys),
    );
    if (args.clusterRun) {
      process.stderr.write(`\nclustering via ${args.clusterRun}...\n`);
      try {
        console.log(
          `\n## Root-cause clusters (${args.clusterRun})\n\n${runAgent(args.clusterRun, prompt).trim()}\n`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(
          `\n## Root-cause clusters\n\n(agent '${args.clusterRun}' failed: ${msg}. Prompt below.)\n`,
        );
        console.log(`\`\`\`\n${prompt}\n\`\`\``);
      }
    } else {
      console.log("\n## Cluster step (run this prompt in your agent context)\n");
      console.log(`\`\`\`cluster-prompt\n${prompt}\n\`\`\``);
    }
  }

  if (!args.noSnapshot) {
    const file = writeSnapshot(dir, snap);
    process.stderr.write(`\nsnapshot saved: ${file}\n`);
  }
  if (args.jsonOut) {
    Bun.write(
      args.jsonOut,
      JSON.stringify(
        {
          seeds: seedKeys,
          depth: args.depth,
          nodes: [...nodes.values()],
          cappedOut: [...cappedOut],
          components: components(nodes),
          overlaps: fileOverlaps(nodes),
          priorities,
        },
        null,
        2,
      ),
    );
    process.stderr.write(`wrote ${args.jsonOut}\n`);
  }
  if (args.htmlOut) {
    const clusters = args.clustersFile
      ? (JSON.parse(readFileSync(args.clustersFile, "utf8")) as ClustersConfig)
      : undefined;
    Bun.write(
      args.htmlOut,
      renderHtml(nodes, seedKeys, `${primary.owner}/${primary.repo}`, clusters),
    );
    process.stderr.write(`wrote ${args.htmlOut}\n`);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    // A transport failure must not look like an empty backlog: exit non-zero so
    // a scripted caller notices.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
