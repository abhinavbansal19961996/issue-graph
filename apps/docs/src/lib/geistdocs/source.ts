import { createSource } from "@vercel/geistdocs/source";
import { docs } from "@/.source/server";
import { canonicalUrl } from "@/lib/site";
import { config } from "./config";

export const geistdocsSource = createSource({
  docs,
  config,
  baseUrl: "/docs",
  markdown: {
    frontmatter: (_fields, { page }) => ({
      canonical_url: canonicalUrl(page.url),
      lastUpdated: page.data.lastModified?.toISOString(),
    }),
    transform: (markdown, { page }) =>
      markdown.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n# ${page.data.title}\n`),
  },
});
