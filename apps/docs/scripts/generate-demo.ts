import { mkdir, writeFile } from "node:fs/promises";
import graph from "../src/lib/example-graph.json";

const escapeXml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ??
      character,
  );
const seed = graph.nodes.find((node) => node.key === graph.seed);
if (!seed) throw new Error("The captured seed is missing.");
const related = graph.edges.map((edge) => graph.nodes.find((node) => node.key === edge.to));
if (related.some((node) => !node)) throw new Error("A captured reference is missing.");

function lines(value: string, width: number) {
  const result: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    if (line.length && line.length + word.length + 1 > width) {
      result.push(line);
      line = word;
    } else line += `${line ? " " : ""}${word}`;
  }
  if (line) result.push(line);
  return result;
}

function nodeCard(
  node: NonNullable<typeof seed>,
  x: number,
  y: number,
  w: number,
  h: number,
  primary = false,
) {
  const title = lines(node.title, primary ? 34 : 43).slice(0, 2);
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="white" stroke="${primary ? "#0070f3" : "#e5e5e5"}"/><text x="${x + 18}" y="${y + 24}" font-size="11" fill="#666">${escapeXml(node.repository)} #${node.number}</text><text x="${x + w - 18}" y="${y + 24}" text-anchor="end" font-size="10" fill="${node.state === "OPEN" ? "#0070f3" : "#666"}">${escapeXml(node.state.toLowerCase())}</text>${title.map((line, i) => `<text x="${x + 18}" y="${y + 49 + i * 19}" font-size="${primary ? 16 : 13}" fill="#171717">${escapeXml(line)}</text>`).join("")}</g>`;
}

const cards = related
  .map((node, i) => (node ? nodeCard(node, 568, 70 + i * 88, 390, 77) : ""))
  .join("");
const wires = related
  .map(
    (_, i) =>
      `<path d="M374 238H464V${108 + i * 88}H568" fill="none" stroke="#0070f3" stroke-opacity=".4" stroke-width="1.2"/>`,
  )
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500" role="img" aria-labelledby="title desc"><title id="title">issue-graph: related work around Portless PR 427</title><desc id="desc">A captured public graph with five pull requests across Portless and wterm. Four seed references connect the docs migration to related work. Capture date ${escapeXml(graph.capturedAt)}.</desc><rect width="1000" height="500" rx="14" fill="#fafafa"/><g font-family="Arial, Helvetica, sans-serif"><text x="34" y="35" font-size="14" font-weight="bold" fill="#171717">issue-graph</text><text x="966" y="35" text-anchor="end" font-size="11" fill="#666">Public reference graph · ${escapeXml(graph.capturedAt.slice(0, 10))}</text><path d="M0 53H1000M0 445H1000" stroke="#e5e5e5"/>${wires}<text x="46" y="156" font-size="10" fill="#666" letter-spacing="1.3">YOUR STARTING POINT</text>${nodeCard(seed, 44, 180, 330, 116, true)}<text x="46" y="322" font-size="12" fill="#666">Five pull requests. Two repositories. One view.</text>${cards}<text x="34" y="477" font-family="monospace" font-size="12" fill="#444">$ ${escapeXml(graph.command)}</text></g></svg>\n`;
await mkdir(new URL("../public/", import.meta.url), { recursive: true });
await writeFile(new URL("../public/issue-graph-demo.svg", import.meta.url), svg);
console.log("Generated issue-graph-demo.svg (1000 x 500) from the checked-in public snapshot.");
