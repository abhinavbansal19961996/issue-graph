export const siteName = "issue-graph";
export const siteUrl = "https://issue-graph.dev";
export const repositoryUrl = "https://github.com/vercel-labs/issue-graph";
export const siteDescription =
  "Find related GitHub issues, competing pull requests, and unresolved follow-ups before you start work. A CLI for maintainers and coding agents.";
export const packageReleasePending = true;
export const repositoryIsPublic = false;
export const plannedInstallCommand = "npx issue-graph --help";
export const exampleCommand = "issue-graph 427 --repo vercel-labs/portless --depth 1 --no-snapshot";
export const isPreview = process.env.VERCEL_ENV === "preview";

export function canonicalUrl(pathname = "/") {
  return new URL(pathname, siteUrl).toString();
}
