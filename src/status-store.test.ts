import * as crypto from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { runNode } from "../tests/node-process.js";
import { buildStatusReport } from "./status.js";
import type { StatusSnapshot } from "./status-history-types.js";
import { toStatusSnapshot } from "./status-snapshot.js";
import {
  latestStatusSnapshot,
  readStatusSnapshot,
  statusHistoryDir,
  writeStatusSnapshot,
} from "./status-store.js";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, linkSync: vi.fn(actual.linkSync) };
});

const time = "2026-09-09T13:00:00.000Z";
const scope = { repos: ["o/r", "o/empty"], authors: ["alice", "bob"] };
let temp: string;
let home: string;

function snapshot(generatedAt = time): StatusSnapshot {
  return toStatusSnapshot(
    buildStatusReport(
      [],
      scope.repos.map((repo) => ({
        repo,
        complete: true,
        pages: 1,
        scanned: 0,
        errors: [],
      })),
      { ...scope, startedAt: generatedAt, generatedAt },
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  temp = fs.mkdtempSync(join(tmpdir(), "issue-graph-status-store-"));
  home = join(temp, "issue-graph-home");
});

afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

describe("status history paths and reads", () => {
  test("scope hashing is case/order insensitive, deduplicated, and collision-resistant", () => {
    const dir = statusHistoryDir(scope, home);
    expect(dir).toBe(
      statusHistoryDir({ repos: ["O/EMPTY", "O/R", "o/r"], authors: ["BOB", "ALICE"] }, home),
    );
    expect(basename(dir)).toMatch(/^[a-f0-9]{64}$/);
    expect(dirname(dir)).toBe(join(home, "status"));
    expect(statusHistoryDir({ repos: ["a-b/c"], authors: ["d"] }, home)).not.toBe(
      statusHistoryDir({ repos: ["a/b-c"], authors: ["d"] }, home),
    );
    expect(statusHistoryDir({ repos: ["o/r"], authors: ["alice-bob"] }, home)).not.toBe(
      statusHistoryDir({ repos: ["o/r"], authors: ["alice", "bob"] }, home),
    );
    expect(dir).not.toBe(statusHistoryDir({ ...scope, authors: ["alice"] }, home));
    expect(fs.existsSync(home)).toBe(false);
  });

  test("missing history and failed explicit reads do not create directories", () => {
    expect(latestStatusSnapshot(scope, home)).toBeNull();
    const missing = join(statusHistoryDir(scope, home), "missing.json");
    expect(() => readStatusSnapshot(missing)).toThrow(missing);
    expect(fs.existsSync(home)).toBe(false);
  });

  test("empty directories and unrelated or temporary files are not snapshots", () => {
    const dir = statusHistoryDir(scope, home);
    fs.mkdirSync(dir, { recursive: true });
    expect(latestStatusSnapshot(scope, home)).toBeNull();
    for (const name of [
      ".writer.tmp",
      "notes.json",
      "2099-01-01T00-00-00-000Z-partial.json.tmp",
      ".2099-01-01T00-00-00-000Z-hidden.json",
    ]) {
      fs.writeFileSync(join(dir, name), "unfinished");
    }
    expect(latestStatusSnapshot(scope, home)).toBeNull();
    expect(fs.readdirSync(dir)).toHaveLength(4);
  });

  test("listing errors other than ENOENT are contextual errors", () => {
    fs.mkdirSync(home);
    fs.writeFileSync(join(home, "status"), "not a directory");
    expect(() => latestStatusSnapshot(scope, home)).toThrow("Cannot list");
    expect(() => latestStatusSnapshot(scope, home)).toThrow(statusHistoryDir(scope, home));
  });

  test("latest corrupt JSON and invalid evidence reject without falling back", () => {
    writeStatusSnapshot(snapshot(), home);
    const latest = writeStatusSnapshot(snapshot("2026-09-10T00:00:00Z"), home);
    fs.writeFileSync(latest, "{");
    expect(() => latestStatusSnapshot(scope, home)).toThrow(latest);
    fs.writeFileSync(latest, JSON.stringify({ ...snapshot(), schemaVersion: 2 }));
    expect(() => latestStatusSnapshot(scope, home)).toThrow("schemaVersion");
  });

  test("latest validates loaded scope rather than trusting its directory", () => {
    const path = writeStatusSnapshot(snapshot(), home);
    const mismatched = snapshot();
    mismatched.scope.authors = ["outsider"];
    fs.writeFileSync(path, JSON.stringify(mismatched));
    expect(() => latestStatusSnapshot(scope, home)).toThrow("scope mismatch");
    expect(() => latestStatusSnapshot(scope, home)).toThrow(path);
  });

  test("loaded scope accepts the caller's different order and case", () => {
    const path = writeStatusSnapshot(snapshot(), home);
    expect(
      latestStatusSnapshot({ repos: ["O/EMPTY", "O/R"], authors: ["BOB", "ALICE"] }, home)?.path,
    ).toBe(path);
  });

  test("explicit old report exports are validated and normalized", () => {
    const file = join(temp, "export.json");
    const report = buildStatusReport([], snapshot().coverage, {
      ...scope,
      startedAt: time,
      generatedAt: time,
    });
    fs.writeFileSync(file, JSON.stringify(report));
    expect(readStatusSnapshot(file).provenance.kind).toBe("imported-report");
    expect(fs.existsSync(home)).toBe(false);
  });

  test("symlinks and directories cannot cross the snapshot regular-file boundary", () => {
    const path = writeStatusSnapshot(snapshot(), home);
    const link = join(temp, "link.json");
    fs.symlinkSync(path, link);
    expect(() => readStatusSnapshot(link)).toThrow("regular file");
    expect(() => readStatusSnapshot(dirname(path))).toThrow("regular file");
    const latest = join(dirname(path), "2099-01-01T00-00-00-000Z-link.json");
    fs.symlinkSync(path, latest);
    expect(() => latestStatusSnapshot(scope, home)).toThrow(latest);
  });

  test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
    "permission-denied listing is not treated as missing history",
    () => {
      const dir = statusHistoryDir(scope, home);
      fs.mkdirSync(dir, { recursive: true });
      fs.chmodSync(dir, 0o000);
      try {
        expect(() => latestStatusSnapshot(scope, home)).toThrow("Cannot list");
      } finally {
        fs.chmodSync(dir, 0o700);
      }
    },
  );
});

describe("immutable status snapshot publication", () => {
  test("round-trips evidence and provenance in an immutable timestamp-and-UUID file", () => {
    const value = snapshot();
    value.provenance = {
      kind: "reconstructed",
      note: "Original observation window",
      sources: ["session:42"],
    };
    const path = writeStatusSnapshot(value, home);
    expect(basename(path)).toMatch(/^2026-09-09T13-00-00-000Z-[a-f0-9-]{36}\.json$/);
    expect(readStatusSnapshot(path)).toEqual(value);
    expect(latestStatusSnapshot(scope, home)).toEqual({ snapshot: value, path });
    expect(fs.readdirSync(dirname(path))).toEqual([basename(path)]);
  });

  test("same timestamp saves remain distinct without overwriting previous bytes", () => {
    const first = writeStatusSnapshot(snapshot(), home);
    const bytes = fs.readFileSync(first, "utf8");
    const secondValue = snapshot();
    secondValue.provenance.note = "Another independent capture";
    const second = writeStatusSnapshot(secondValue, home);
    expect(first).not.toBe(second);
    expect(fs.readFileSync(first, "utf8")).toBe(bytes);
    expect(readStatusSnapshot(second)).toEqual(secondValue);
    expect(fs.readdirSync(dirname(first))).toHaveLength(2);
    expect(latestStatusSnapshot(scope, home)?.path).toBe([first, second].sort().at(-1));
  });

  test("generatedAt controls chronology, not save time, mtime, or timezone spelling", () => {
    const live = writeStatusSnapshot(snapshot("2026-09-09T13:00:00Z"), home);
    const baseline = snapshot("2026-09-09T14:00:00+02:00");
    baseline.provenance = {
      kind: "reconstructed",
      note: "Earlier evidence saved later",
      sources: ["session:old"],
    };
    const old = writeStatusSnapshot(baseline, home);
    fs.utimesSync(old, new Date("2099-01-01"), new Date("2099-01-01"));
    expect(basename(old).startsWith("2026-09-09T12-00-00-000Z-")).toBe(true);
    expect(latestStatusSnapshot(scope, home)?.path).toBe(live);
  });

  test.skipIf(process.platform === "win32")(
    "managed storage is private while an existing root keeps its permissions",
    () => {
      const dir = statusHistoryDir(scope, home);
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      const rootMode = fs.statSync(home).mode & 0o777;
      const path = writeStatusSnapshot(snapshot(), home);
      expect(fs.statSync(home).mode & 0o777).toBe(rootMode);
      for (const folder of [join(home, "status"), dir]) {
        expect(fs.statSync(folder).mode & 0o777).toBe(0o700);
      }
      expect(fs.statSync(path).mode & 0o777).toBe(0o600);
    },
  );

  test("malformed writes fail before creating history directories", () => {
    const value = snapshot();
    value.coverage = [];
    expect(() => writeStatusSnapshot(value, home)).toThrow("omits");
    expect(fs.existsSync(home)).toBe(false);
  });

  test("symlink storage directories are rejected without touching their target", () => {
    const target = join(temp, "target");
    fs.mkdirSync(target, { mode: 0o755 });
    fs.mkdirSync(home);
    fs.symlinkSync(target, join(home, "status"));
    expect(() => writeStatusSnapshot(snapshot(), home)).toThrow("regular directory");
    expect(fs.readdirSync(target)).toEqual([]);
    if (process.platform !== "win32") expect(fs.statSync(target).mode & 0o777).toBe(0o755);
  });

  test("failed publication cleans only its owned temp and preserves other writers' files", () => {
    const dir = statusHistoryDir(scope, home);
    fs.mkdirSync(dir, { recursive: true });
    const other = join(dir, ".another-writer.tmp");
    fs.writeFileSync(other, "someone else's pending capture");
    const publish = vi.mocked(fs.linkSync).mockImplementationOnce(() => {
      const temps = fs.readdirSync(dir).filter((name) => name.endsWith(".tmp"));
      expect(temps).toHaveLength(2);
      expect(fs.readdirSync(dir).some((name) => name.endsWith(".json"))).toBe(false);
      throw Object.assign(new Error("publication failed"), { code: "EIO" });
    });
    try {
      expect(() => writeStatusSnapshot(snapshot(), home)).toThrow("publication failed");
      expect(publish).toHaveBeenCalledTimes(1);
    } finally {
      publish.mockReset();
    }
    expect(fs.readdirSync(dir)).toEqual([basename(other)]);
    expect(fs.readFileSync(other, "utf8")).toBe("someone else's pending capture");
  });

  test("exclusive publication retries UUID collisions without overwriting or deleting unowned temps", () => {
    const dir = statusHistoryDir(scope, home);
    fs.mkdirSync(dir, { recursive: true });
    const collision = "00000000-0000-4000-8000-000000000000";
    const other = join(dir, `.${collision}.tmp`);
    fs.writeFileSync(other, "other writer");
    const uuid = vi.mocked(crypto.randomUUID).mockReturnValueOnce(collision);
    try {
      const path = writeStatusSnapshot(snapshot(), home);
      expect(readStatusSnapshot(path)).toEqual(snapshot());
      expect(fs.readFileSync(other, "utf8")).toBe("other writer");
      expect(fs.readdirSync(dir)).toHaveLength(2);
    } finally {
      uuid.mockReset();
    }
    const existing = writeStatusSnapshot(snapshot(), home);
    const id = basename(existing).slice("2026-09-09T13-00-00-000Z-".length, -5);
    const original = fs.readFileSync(existing, "utf8");
    const duplicate = vi
      .mocked(crypto.randomUUID)
      .mockReturnValueOnce(id as ReturnType<typeof crypto.randomUUID>);
    try {
      const path = writeStatusSnapshot(snapshot(), home);
      expect(path).not.toBe(existing);
      expect(fs.readFileSync(existing, "utf8")).toBe(original);
      expect(fs.readdirSync(dir).filter((name) => name.endsWith(".tmp"))).toEqual([
        basename(other),
      ]);
    } finally {
      duplicate.mockReset();
    }
  });

  test("separate concurrent processes safely publish captures with the same timestamp", async () => {
    const module = new URL("./status-store.ts", import.meta.url).href;
    const code = `import { writeStatusSnapshot } from ${JSON.stringify(module)}; process.stdout.write(writeStatusSnapshot(${JSON.stringify(snapshot())}, ${JSON.stringify(home)}));`;
    const children = Array.from({ length: 6 }, () =>
      runNode(["--input-type=module", "--eval", code]),
    );
    const results = (await Promise.all(children)).map((child) => ({
      code: child.code,
      path: child.stdout,
      error: child.stderr,
    }));
    expect(results.map((result) => ({ code: result.code, error: result.error }))).toEqual(
      Array.from({ length: 6 }, () => ({ code: 0, error: "" })),
    );
    expect(new Set(results.map((result) => result.path)).size).toBe(6);
    for (const result of results) expect(readStatusSnapshot(result.path)).toEqual(snapshot());
    expect(fs.readdirSync(statusHistoryDir(scope, home))).toHaveLength(6);
  });
});
