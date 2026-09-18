import { releaseNotice } from "@/lib/discovery";
import {
  landingDescription,
  landingLastModified,
  landingTitle,
  workflows,
} from "@/lib/landing-content";
import { canonicalUrl, exampleCommand, siteDescription, siteName } from "@/lib/site";
import { textResponse } from "@/lib/text-response";

export const dynamic = "force-dynamic";

export function GET() {
  return textResponse(
    [
      "---",
      `title: ${JSON.stringify(siteName)}`,
      `description: ${JSON.stringify(siteDescription)}`,
      `canonical_url: ${JSON.stringify(canonicalUrl("/"))}`,
      `lastUpdated: ${landingLastModified}`,
      "---",
      "",
      `# ${siteName}`,
      "",
      landingTitle,
      "",
      landingDescription,
      "",
      releaseNotice(),
      "",
      "Inspect references, competing fixes, status, and follow-ups before starting work. GitHub access is read-only. Local snapshots may write files; use --no-snapshot for a graph run without persisting a snapshot.",
      "",
      "Example command for an installed CLI, not a claim of live results:",
      "",
      "```sh",
      exampleCommand,
      "```",
      "",
      ...workflows.flatMap((workflow) => [
        `## ${workflow.title}`,
        "",
        workflow.description,
        "",
        "```sh",
        workflow.command,
        "```",
        "",
        `[${workflow.link}](${canonicalUrl(workflow.href)})`,
        "",
      ]),
      "## Resources",
      "",
      `- [Documentation](${canonicalUrl("/docs")})`,
      `- [Getting started](${canonicalUrl("/docs/get-started")})`,
      `- [For agents](${canonicalUrl("/docs/agents")})`,
      `- [Skill](${canonicalUrl("/skill.md")})`,
      `- [Documentation index](${canonicalUrl("/llms.txt")})`,
      "",
    ].join("\n"),
    "/",
  );
}
