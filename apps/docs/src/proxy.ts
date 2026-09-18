import { shouldServeMarkdown } from "@vercel/agent-readability";
import { type NextRequest, NextResponse } from "next/server";
import { isFlightRequest } from "@/lib/docs-paths";
import { applyDocsResponseHeaders } from "@/lib/docs-response-headers";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response: NextResponse;
  try {
    decodeURIComponent(pathname);
  } catch {
    response = new NextResponse("Not Found", { status: 404 });
    applyDocsResponseHeaders(response.headers);
    return response;
  }
  const negotiable = pathname === "/" || pathname === "/docs" || pathname.startsWith("/docs/");
  if (
    negotiable &&
    !pathname.endsWith(".md") &&
    !isFlightRequest(request.headers) &&
    !request.nextUrl.searchParams.has("_rsc") &&
    (request.method === "GET" || request.method === "HEAD") &&
    shouldServeMarkdown({ headers: request.headers }).serve
  ) {
    const destination = request.nextUrl.clone();
    destination.pathname =
      pathname === "/" ? "/api/landing-md" : `/api/docs-md${pathname.slice(5)}`;
    response = NextResponse.rewrite(destination);
  } else {
    response = NextResponse.next();
  }
  applyDocsResponseHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/", "/index.md", "/docs.md", "/docs/:path*"],
};
