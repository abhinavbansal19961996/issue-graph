/**
 * How the crawl talks to GitHub. The graph logic is pure; only this seam does
 * I/O, so the same code runs from the CLI (shelling out to an authenticated
 * `gh`) and from a server with no `gh` binary (plain `fetch` and a token).
 *
 * This module stays dependency-free and importable from any runtime — the two
 * implementations live in `./transports/*` so that importing the core never
 * pulls in `node:child_process`.
 */

/** A seed resolved from a search, in the crawl's own coordinates. */
export interface SeedRef {
  owner: string;
  repo: string;
  number: number;
}

export interface GhTransport {
  /**
   * Run a GraphQL query and return the raw `{data, errors}` envelope. The
   * caller inspects `errors`; a transport only throws when the request itself
   * failed (network, auth, rate limit) so a retry can be distinguished from a
   * query the server understood and rejected.
   */
  graphql(query: string, variables?: Record<string, string | number>): Promise<unknown>;

  /**
   * Resolve seeds from a GitHub search query (`repo:o/r is:open is:issue`).
   * Separate from `graphql` because the CLI answers it with `gh issue list`,
   * which needs no query string of its own.
   */
  search(query: string, limit: number): Promise<SeedRef[]>;
}

/** Thrown when a request failed in a way that says nothing about the data. */
export class GhTransportError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GhTransportError";
  }
}
