export function testUrl(): URL {
  const value = process.env.DOCS_TEST_URL;
  if (!value)
    throw new Error(
      "Set DOCS_TEST_URL to the already-running docs server, for example http://localhost:3000.",
    );
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "DOCS_TEST_URL must be an HTTP(S) origin without credentials, a path, query, or fragment.",
    );
  }
  return url;
}
