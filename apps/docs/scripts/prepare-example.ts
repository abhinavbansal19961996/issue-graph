import assert from "node:assert/strict";
import { readFile, stat, writeFile } from "node:fs/promises";

type Node = {
  key: string;
  repo: string;
  number: number;
  title: string;
  state: string;
  url: string;
  fetched: boolean;
  edges: { to: string; via: string }[];
};

const input = process.argv[2];
if (!input) throw new Error("Provide a JSON export of the public Portless #427 graph.");
const graph = JSON.parse(await readFile(input, "utf8")) as {
  seeds: string[];
  nodes: Node[];
  cappedOut: unknown[];
};
assert.deepEqual(graph.seeds, ["vercel-labs/portless#427"]);
assert.equal(graph.cappedOut.length, 0);
const allowed = new Set(["vercel-labs/portless", "vercel-labs/wterm"]);
const seed = graph.nodes.find((node) => node.key === graph.seeds[0]);
assert(seed?.fetched);
const keys = new Set([seed.key, ...seed.edges.map((edge) => edge.to)]);
const nodes = graph.nodes
  .filter((node) => keys.has(node.key))
  .map((node) => {
    const url = new URL(node.url);
    assert(node.fetched);
    assert.equal(url.origin, "https://github.com");
    assert(allowed.has(node.key.split("#")[0]));
    assert.equal(url.pathname, `/${node.key.split("#")[0]}/pull/${node.number}`);
    assert(["OPEN", "CLOSED", "MERGED"].includes(node.state));
    return {
      key: node.key,
      repository: node.repo,
      number: node.number,
      title: node.title,
      state: node.state,
      url: url.toString(),
    };
  });
assert.equal(nodes.length, keys.size);
const output = {
  capturedAt: (await stat(input)).mtime.toISOString(),
  command: "issue-graph 427 --repo vercel-labs/portless --depth 1 --no-snapshot",
  seed: seed.key,
  nodes,
  edges: seed.edges.map((edge) => ({ from: seed.key, to: edge.to, via: edge.via })),
};
await writeFile(
  new URL("../src/lib/example-graph.json", import.meta.url),
  `${JSON.stringify(output, null, 2)}\n`,
);
console.log(
  `Prepared ${nodes.length} public nodes and ${output.edges.length} seed references. External links, authors, comments and other metadata excluded.`,
);
