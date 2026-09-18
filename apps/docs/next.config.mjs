import { fileURLToPath } from "node:url";
import { createGeistdocs } from "@vercel/geistdocs/next";

const withMDX = createGeistdocs();

export default withMDX({
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  skipProxyUrlNormalize: true,
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  outputFileTracingIncludes: {
    "/skill.md": ["../../skills/issue-graph/SKILL.md"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.VERCEL_ENV === "preview"
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]
            : []),
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/index.md", destination: "/api/landing-md" },
        { source: "/docs.md", destination: "/api/docs-md" },
        { source: "/docs/index.md", destination: "/api/docs-md" },
        { source: "/docs/:path*.md", destination: "/api/docs-md/:path*" },
      ],
    };
  },
});
