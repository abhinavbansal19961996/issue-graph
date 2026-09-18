import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { textResponse } from "@/lib/text-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const skill = await readFile(resolve(process.cwd(), "../../skills/issue-graph/SKILL.md"), "utf8");
  return textResponse(skill, "/skill.md");
}
