import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { UpdateInfo } from "../src/updater.ts";
import {
  compareVersions,
  getCurrentVersion,
  getConfigDir,
  getLastCheckTime,
  setLastCheckTime,
  getAvailableUpdate,
  setAvailableUpdate,
  clearAvailableUpdate,
  shouldCheck,
  printUpdateNotice,
} from "../src/updater.ts";

// ── Version comparison ──────────────────────────────────────────

describe("compareVersions", () => {
  test("equal versions return 0", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  test("strips v prefix", () => {
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("v2.0.0", "v1.0.0")).toBe(1);
  });

  test("major version difference", () => {
    expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
  });

  test("minor version difference", () => {
    expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
    expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
  });

  test("patch version difference", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
    expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
  });

  test("handles missing parts", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1", "1.0.0")).toBe(0);
  });

  test("complex comparisons", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
    expect(compareVersions("10.0.0", "9.9.9")).toBe(1);
  });
});

// ── getCurrentVersion ───────────────────────────────────────────

describe("getCurrentVersion", () => {
  test("returns a valid semver string", () => {
    const version = getCurrentVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ── Config directory ────────────────────────────────────────────

describe("getConfigDir", () => {
  const origXdg = process.env["XDG_CONFIG_HOME"];
  const origHome = process.env["HOME"];

  afterEach(() => {
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg;
    } else {
      delete process.env["XDG_CONFIG_HOME"];
    }
    if (origHome !== undefined) {
      process.env["HOME"] = origHome;
    }
  });

  test("uses XDG_CONFIG_HOME when set", () => {
    process.env["XDG_CONFIG_HOME"] = "/tmp/xdg-test";
    expect(getConfigDir()).toBe("/tmp/xdg-test/recs");
  });

  test("falls back to ~/.config when XDG not set", () => {
    delete process.env["XDG_CONFIG_HOME"];
    process.env["HOME"] = "/tmp/test-home";
    expect(getConfigDir()).toBe("/tmp/test-home/.config/recs");
  });
});

// ── State file management ───────────────────────────────────────

describe("state files", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("last check time", () => {
    test("returns 0 when no file exists", () => {
      expect(getLastCheckTime(tmpDir)).toBe(0);
    });

    test("reads and writes timestamp", () => {
      const now = Date.now();
      setLastCheckTime(tmpDir, now);
      expect(getLastCheckTime(tmpDir)).toBe(now);
    });

    test("overwrites previous timestamp", () => {
      setLastCheckTime(tmpDir, 1000);
      setLastCheckTime(tmpDir, 2000);
      expect(getLastCheckTime(tmpDir)).toBe(2000);
    });
  });

  describe("available update", () => {
    test("returns null when no file exists", () => {
      expect(getAvailableUpdate(tmpDir)).toBeNull();
    });

    test("reads and writes update info", () => {
      const info = { version: "1.2.3", checkedAt: Date.now() };
      setAvailableUpdate(tmpDir, info);
      expect(getAvailableUpdate(tmpDir)).toEqual(info);
    });

    test("clearAvailableUpdate removes the file", () => {
      const info = { version: "1.0.0", checkedAt: Date.now() };
      setAvailableUpdate(tmpDir, info);
      expect(getAvailableUpdate(tmpDir)).not.toBeNull();

      clearAvailableUpdate(tmpDir);
      expect(getAvailableUpdate(tmpDir)).toBeNull();
    });

    test("clearAvailableUpdate is safe when no file exists", () => {
      // Should not throw
      clearAvailableUpdate(tmpDir);
      expect(getAvailableUpdate(tmpDir)).toBeNull();
    });
  });

  describe("shouldCheck", () => {
    test("returns true when no timestamp file exists", () => {
      expect(shouldCheck(tmpDir)).toBe(true);
    });

    test("returns false when checked recently", () => {
      setLastCheckTime(tmpDir, Date.now());
      expect(shouldCheck(tmpDir)).toBe(false);
    });

    test("returns true when timestamp is stale (>24h)", () => {
      const moreThan24hAgo = Date.now() - 25 * 60 * 60 * 1000;
      setLastCheckTime(tmpDir, moreThan24hAgo);
      expect(shouldCheck(tmpDir)).toBe(true);
    });

    test("returns false when timestamp is just under 24h", () => {
      const justUnder24h = Date.now() - 23 * 60 * 60 * 1000;
      setLastCheckTime(tmpDir, justUnder24h);
      expect(shouldCheck(tmpDir)).toBe(false);
    });
  });
});

// ── printUpdateNotice ──────────────────────────────────────────

describe("printUpdateNotice", () => {
  const origXdg = process.env["XDG_CONFIG_HOME"];
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "recs-notice-test-"));
    process.env["XDG_CONFIG_HOME"] = tmpDir;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (origXdg !== undefined) {
      process.env["XDG_CONFIG_HOME"] = origXdg;
    } else {
      delete process.env["XDG_CONFIG_HOME"];
    }
  });

  test("returns null when no update file exists", () => {
    expect(printUpdateNotice()).toBeNull();
  });

  test("returns update info and writes to stderr when update available", () => {
    const { mkdirSync } = require("node:fs") as typeof import("node:fs");
    const configDir = join(tmpDir, "recs");
    mkdirSync(configDir, { recursive: true });

    const info: UpdateInfo = { version: "2.0.0", checkedAt: Date.now() };
    writeFileSync(join(configDir, "update-available"), JSON.stringify(info), "utf-8");

    const chunks: string[] = [];
    const origWrite = process.stderr.write;
    process.stderr.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = printUpdateNotice();
      expect(result).not.toBeNull();
      expect(result!.version).toBe("2.0.0");
      expect(chunks.join("")).toContain("v2.0.0 available");
      expect(chunks.join("")).toContain("recs --update");
    } finally {
      process.stderr.write = origWrite;
    }
  });
});
