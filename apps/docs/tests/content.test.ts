import { readdir, readFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { docsSlugs } from "../src/lib/docs-paths";

const contentRoot = new URL("../content/docs/", import.meta.url);
const appRoot = new URL("../", import.meta.url);
const read = (path: string) => readFile(new URL(path, appRoot), "utf8");

function withoutCodeFences(body: string): string {
  return body.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
}

describe("documentation content contract", () => {
  test("matches the navigation inventory and has one runtime-owned title", async () => {
    const files = (await readdir(contentRoot)).filter((name) => name.endsWith(".mdx")).sort();
    expect(files).toEqual(docsSlugs.map((slug) => `${slug || "index"}.mdx`).sort());
    const meta = JSON.parse(await read("content/docs/meta.json"));
    expect(meta.pages).toEqual(docsSlugs.map((slug) => slug || "index"));
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    const pages = new Set<string>([
      "/",
      "/skill.md",
      "/llms.txt",
      "/sitemap.md",
      ...docsSlugs.map((slug) => (slug ? `/docs/${slug}` : "/docs")),
    ]);
    for (const file of files) {
      const raw = await readFile(new URL(file, contentRoot), "utf8");
      const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
      expect(frontmatter).not.toBeNull();
      const title = frontmatter?.[1]?.match(/^title:\s*(.+)$/m)?.[1];
      const description = frontmatter?.[1]?.match(/^description:\s*(.+)$/m)?.[1];
      expect(title?.length).toBeGreaterThan(2);
      expect(description?.length).toBeGreaterThan(20);
      expect(titles.has(title ?? "")).toBe(false);
      expect(descriptions.has(description ?? "")).toBe(false);
      titles.add(title ?? "");
      descriptions.add(description ?? "");
      const body = withoutCodeFences(raw.slice(frontmatter?.[0].length ?? 0));
      expect(body).not.toMatch(/^#\s/m);
      expect(body).not.toMatch(/<h1[\s>]/i);
      for (const match of body.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        const pathname = match[1]?.split(/[?#]/)[0] ?? "";
        expect(pages.has(pathname)).toBe(true);
      }
    }
  });

  test("retains honest pending-release and local-write disclosures", async () => {
    const [intro, start, security] = await Promise.all([
      read("content/docs/index.mdx"),
      read("content/docs/get-started.mdx"),
      read("content/docs/security.mdx"),
    ]);
    expect(intro.toLowerCase()).toContain("pending");
    expect(start.toLowerCase()).toContain("internal");
    expect(security.toLowerCase()).toContain("snapshot");
  });

  test("enables the native GitHub navbar link without changing source access", async () => {
    const [config, site] = await Promise.all([
      read("src/lib/geistdocs/config.tsx"),
      read("src/lib/site.ts"),
    ]);
    expect(config).toContain("navbarGithub: { enabled: true }");
    expect(config).toContain('owner: "vercel-labs"');
    expect(config).toContain('repo: "issue-graph"');
    expect(config).not.toContain("...(repositoryIsPublic");
    expect(config).toContain("editSource: repositoryIsPublic");
    expect(site).toContain("repositoryIsPublic = false");
  });

  test("pins the public runtime and uses no initializer or private provider", async () => {
    const pkg = JSON.parse(await read("package.json"));
    expect(pkg.name).toBe("@issue-graph/docs");
    expect(pkg.private).toBe(true);
    for (const [name, version] of Object.entries({
      "@vercel/geistdocs": "2.2.0",
      "@vercel/agent-readability": "0.7.0",
      next: "16.3.5",
      react: "19.3.0",
      "react-dom": "19.3.0",
      geist: "1.7.2",
      "fumadocs-core": "16.2.2",
      "fumadocs-mdx": "14.0.4",
    }))
      expect(pkg.dependencies[name]).toBe(version);
    expect(pkg.devDependencies.tailwindcss).toBe("4.3.3");
    expect(JSON.stringify(pkg)).not.toMatch(/eslint|geistdocs init|@vercel\/geist(?=")/);
    expect(pkg.scripts.test).toMatch(/^vitest run(?:\s|$)/);
    expect(pkg.scripts["test:routes"]).toBe("tsx scripts/test-routes.ts");
    expect(pkg.scripts["test:ci"]).toBe("tsx scripts/verify-site.ts");
    expect(pkg.scripts.audit).toBe("tsx scripts/audit.ts");
    const config = await read("src/lib/geistdocs/config.tsx");
    expect(config).toContain("webmcp: { enabled: true }");
    expect(config).toContain("ai: { enabled: false }");
    expect(config).toContain("editSource: repositoryIsPublic");
    const layout = await read("src/app/layout.tsx");
    expect(layout).toContain("@vercel/geistdocs/navbar");
    expect(layout).toContain("@vercel/geistdocs/footer");
    expect(layout).toContain('href="#main-content"');
    expect(layout).not.toMatch(/<main[\s>]/);
    const skillRoute = await read("src/app/skill.md/route.ts");
    expect(skillRoute).toContain("../../skills/issue-graph/SKILL.md");
    expect(skillRoute).not.toContain("params");
  });
});
