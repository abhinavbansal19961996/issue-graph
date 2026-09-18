import { sitemapMarkdown } from "@/lib/discovery";
import { textResponse } from "@/lib/text-response";

export const dynamic = "force-dynamic";

export function GET() {
  return textResponse(sitemapMarkdown(), "/sitemap.md");
}
