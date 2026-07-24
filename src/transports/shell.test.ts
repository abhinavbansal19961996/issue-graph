import { expect, describe as suite, test } from "bun:test";
import { decodeStdout, describe } from "./shell.js";

/** Shape of the error `execFileSync` throws on a non-zero exit. */
const exitError = (stdout: string, stderr = "") =>
  Object.assign(new Error("Command failed: gh"), {
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr),
  });

suite("decodeStdout", () => {
  // `gh api graphql` exits non-zero for a GraphQL error but still prints the
  // body. Losing that body is what turned one deleted reference into a crawl
  // that died halfway through.
  test("recovers the GraphQL envelope from a non-zero exit", () => {
    const body = { data: { repository: { issueOrPullRequest: null } }, errors: [{ message: "x" }] };
    expect(decodeStdout(exitError(JSON.stringify(body)))).toEqual(body);
  });

  test("returns null when there is no body to recover", () => {
    expect(decodeStdout(exitError(""))).toBeNull();
    expect(decodeStdout(exitError("gh: command not found"))).toBeNull();
    expect(decodeStdout(new Error("spawn ENOENT"))).toBeNull();
  });

  test("returns null for a non-object JSON body", () => {
    expect(decodeStdout(exitError('"just a string"'))).toBeNull();
  });
});

suite("describe", () => {
  test("prefers gh's own stderr over the exit-code message", () => {
    expect(describe(exitError("", "gh: Bad credentials"))).toBe("gh: Bad credentials");
  });

  test("falls back to the error message when stderr is empty", () => {
    expect(describe(exitError("", "  "))).toBe("Command failed: gh");
    expect(describe(new Error("spawn ENOENT"))).toBe("spawn ENOENT");
  });
});
