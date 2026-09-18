import { generateNotFoundMarkdown } from "@vercel/agent-readability";
import { docsPath, isSafePathSegments } from "@/lib/docs-paths";
import { geistdocsSource } from "@/lib/geistdocs/source";
import { siteUrl } from "@/lib/site";
import { textResponse } from "@/lib/text-response";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const safe = isSafePathSegments(slug);
  const page = safe ? geistdocsSource.source.getPage(slug, "en") : undefined;
  if (!page) {
    return textResponse(
      generateNotFoundMarkdown(safe ? docsPath(slug) : "/docs/not-found", {
        baseUrl: siteUrl,
        sitemapUrl: "/sitemap.md",
        indexUrl: "/llms.txt",
        exampleUrl: "/docs/get-started",
      }),
      null,
      "text/markdown; charset=utf-8",
      404,
    );
  }
  return textResponse(await geistdocsSource.getPageMarkdown(page), docsPath(page.slugs));
}
