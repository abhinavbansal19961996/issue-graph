import graph from "@/lib/example-graph.json";
import { CopyCommand } from "./copy-command";

export function GraphProof() {
  const seed = graph.nodes.find((node) => node.key === graph.seed);
  const related = graph.edges.map((edge) => graph.nodes.find((node) => node.key === edge.to));
  if (!seed || related.some((node) => !node)) return null;
  const captured = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(graph.capturedAt));

  return (
    <figure className="ig-proof" aria-labelledby="graph-proof-caption">
      <div className="ig-proof-bar">
        <span>
          <span className="ig-status-dot" /> Reference graph
        </span>
        <span className="ig-proof-meta">vercel-labs / portless</span>
      </div>
      <div className="ig-graph-board">
        <svg
          className="ig-graph-wires"
          viewBox="0 0 1000 400"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          {[54, 151, 248, 345].map((y) => (
            <path
              key={y}
              d={`M390 200 H445 Q470 200 470 ${y < 200 ? 175 : 225} V${y < 200 ? y + 20 : y - 20} Q470 ${y} 495 ${y} H560`}
            />
          ))}
          <circle cx="390" cy="200" r="5" />
        </svg>
        <div className="ig-graph-seed">
          <span className="ig-eyebrow">Your starting point</span>
          <a className="ig-node ig-node-seed" href={seed.url} target="_blank" rel="noreferrer">
            <div className="ig-node-meta">
              <span>portless #{seed.number}</span>
              <span className="ig-node-state">{seed.state.toLowerCase()}</span>
            </div>
            <span className="ig-node-title">{seed.title}</span>
            <span className="ig-node-detail">
              {graph.edges.length} references to follow <span aria-hidden="true">↗</span>
            </span>
          </a>
          <span className="ig-seed-hint">One command. The surrounding work.</span>
        </div>
        <div className="ig-related-nodes">
          {related.map((node) =>
            node ? (
              <a
                className="ig-node"
                key={node.key}
                href={node.url}
                target="_blank"
                rel="noreferrer"
              >
                <div className="ig-node-meta">
                  <span>
                    {node.repository} #{node.number}
                  </span>
                  <span
                    className={`ig-node-state ${node.state === "MERGED" ? "ig-node-merged" : ""}`}
                  >
                    {node.state.toLowerCase()}
                  </span>
                </div>
                <span className="ig-node-title">{node.title}</span>
              </a>
            ) : null,
          )}
        </div>
      </div>
      <div className="ig-proof-command">
        <CopyCommand command={graph.command} label="Copy the public graph example" />
      </div>
      <figcaption id="graph-proof-caption" className="ig-proof-caption">
        <span>Real public data, captured {captured}. Seed references shown; not a live feed.</span>
        <a href="/docs/graph">
          Reproduce this graph <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
    </figure>
  );
}
