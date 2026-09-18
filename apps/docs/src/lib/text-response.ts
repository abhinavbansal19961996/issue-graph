import { applyDocsResponseHeaders } from "./docs-response-headers";
import { canonicalUrl, isPreview } from "./site";

export function textResponse(
  body: string,
  pathname: string | null,
  contentType = "text/markdown; charset=utf-8",
  status = 200,
): Response {
  const headers = new Headers({ "Content-Type": contentType });
  applyDocsResponseHeaders(headers);
  if (pathname && status === 200) {
    headers.set("Link", `<${canonicalUrl(pathname)}>; rel="canonical"`);
  }
  if (isPreview || status === 404) headers.set("X-Robots-Tag", "noindex, nofollow");
  return new Response(body, { status, headers });
}
