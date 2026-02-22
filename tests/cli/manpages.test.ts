import { describe, test, expect, beforeAll } from "bun:test";
import { existsSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const MAN_DIR = join(import.meta.dir, "..", "..", "man", "man1");

describe("man page generation", () => {
  beforeAll(async () => {
    // Clean and regenerate
    if (existsSync(MAN_DIR)) {
      rmSync(MAN_DIR, { recursive: true });
    }
    mkdirSync(MAN_DIR, { recursive: true });
    await $`bun scripts/generate-manpages.ts`.cwd(
      join(import.meta.dir, "..", "..")
    );
  });

  test("generates recs.1 main man page", () => {
    expect(existsSync(join(MAN_DIR, "recs.1"))).toBe(true);
  });

  test("generates man page for every operation", () => {
    const expectedCommands = [
      "fromapache", "fromatomfeed", "fromcsv", "fromdb", "fromjsonarray",
      "fromkv", "frommongo", "frommultire", "fromps", "fromre",
      "fromsplit", "fromtcpdump", "fromxferlog", "fromxml",
      "annotate", "assert", "chain", "collate", "decollate", "delta",
      "eval", "expandjson", "flatten", "generate", "grep", "join", "multiplex",
      "normalizetime", "sort", "stream2table", "substream", "topn", "xform",
      "tochart", "tocsv", "todb", "togdgraph", "tognuplot", "tohtml",
      "tojsonarray", "toprettyprint", "toptable", "totable",
    ];

    for (const cmd of expectedCommands) {
      const path = join(MAN_DIR, `recs-${cmd}.1`);
      expect(existsSync(path)).toBe(true);
    }
  });

  test("generates exactly 44 man pages (43 commands + recs.1)", () => {
    const { readdirSync } = require("node:fs");
    const files = (readdirSync(MAN_DIR) as string[]).filter(
      (f: string) => f.endsWith(".1")
    );
    expect(files.length).toBe(44);
  });

  test("recs.1 contains proper troff header", () => {
    const content = readFileSync(join(MAN_DIR, "recs.1"), "utf8");
    expect(content).toContain('.TH RECS 1');
    expect(content).toContain("RecordStream Manual");
  });

  test("recs.1 lists all three command categories", () => {
    const content = readFileSync(join(MAN_DIR, "recs.1"), "utf8");
    expect(content).toContain(".SH INPUT COMMANDS");
    expect(content).toContain(".SH TRANSFORM COMMANDS");
    expect(content).toContain(".SH OUTPUT COMMANDS");
  });

  test("command man pages have correct sections", () => {
    const content = readFileSync(join(MAN_DIR, "recs-grep.1"), "utf8");
    expect(content).toContain(".SH NAME");
    expect(content).toContain(".SH SYNOPSIS");
    expect(content).toContain(".SH DESCRIPTION");
    expect(content).toContain(".SH OPTIONS");
    expect(content).toContain(".SH EXAMPLES");
    expect(content).toContain(".SH SEE ALSO");
    expect(content).toContain(".SH AUTHOR");
  });

  test("command man pages use proper troff formatting", () => {
    const content = readFileSync(join(MAN_DIR, "recs-grep.1"), "utf8");
    // Bold flags with \fB...\fR
    expect(content).toContain("\\fB");
    expect(content).toContain("\\fR");
    // Option blocks use .TP macro
    expect(content).toContain(".TP");
    // Examples use .nf/.fi for no-fill
    expect(content).toContain(".nf");
    expect(content).toContain(".fi");
  });

  test("command man pages escape special characters", () => {
    const content = readFileSync(join(MAN_DIR, "recs-grep.1"), "utf8");
    // Dashes in description text should be escaped as \-
    expect(content).toContain("\\-");
  });
});
