import { ImageResponse } from "next/og";
import { isSafePathSegments } from "@/lib/docs-paths";
import { geistdocsSource } from "@/lib/geistdocs/source";
import { landingTitle } from "@/lib/landing-content";

export async function GET(_request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params;
  let title = landingTitle;
  let category = "GitHub context, before you code.";
  if (slug.length) {
    if (slug[0] !== "docs" || !isSafePathSegments(slug))
      return new Response("Not Found", { status: 404 });
    const page = geistdocsSource.source.getPage(slug.slice(1), "en");
    if (!page) return new Response("Not Found", { status: 404 });
    title = page.data.title ?? "Documentation";
    category = "issue-graph documentation";
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "62px 70px",
        background: "#fafafa",
        color: "#171717",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, letterSpacing: -1 }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <title>issue-graph mark</title>
          <path d="M10 10 30 20 10 30V10" stroke="#0070f3" strokeWidth="2" />
          <circle cx="10" cy="10" r="4" fill="#171717" />
          <circle cx="30" cy="20" r="4" fill="#171717" />
          <circle cx="10" cy="30" r="4" fill="#171717" />
        </svg>
        <span>issue-graph</span>
        <span style={{ marginLeft: "auto", color: "#666", fontSize: 20, letterSpacing: 0 }}>
          Vercel Labs
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 45 ? 64 : 76,
            lineHeight: 1.06,
            letterSpacing: -4,
            maxWidth: 790,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
        <svg width="220" height="235" viewBox="0 0 220 235" fill="none">
          <title>One starting point connected to related work</title>
          <path d="M36 117H96V40H180M96 117H180M96 117V194H180" stroke="#0070f3" strokeWidth="2" />
          <rect x="10" y="91" width="52" height="52" rx="12" fill="#171717" />
          <circle cx="36" cy="117" r="9" stroke="white" strokeWidth="2" />
          {[40, 117, 194].map((y) => (
            <g key={y}>
              <rect x="158" y={y - 21} width="44" height="42" rx="9" fill="white" stroke="#ddd" />
              <circle cx="180" cy={y} r="5" fill="#0070f3" />
            </g>
          ))}
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #ddd",
          paddingTop: 24,
          fontSize: 19,
          color: "#666",
        }}
      >
        <span>{category}</span>
        <span>issue-graph.dev</span>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
