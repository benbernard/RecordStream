import { describe, test, expect } from "bun:test";
import {
  loadAllDocs,
  loadDocForCommand,
  docToHelpText,
  formatCommandList,
} from "../../src/cli/help.ts";
import type { CommandDoc } from "../../src/types/CommandDoc.ts";

describe("loadAllDocs", () => {
  test("loads documentation for all 42 operations", async () => {
    const docs = await loadAllDocs();
    expect(docs.length).toBe(42);
  });

  test("every doc has required fields", async () => {
    const docs = await loadAllDocs();
    for (const doc of docs) {
      expect(doc.name).toBeTruthy();
      expect(doc.category).toMatch(/^(input|transform|output)$/);
      expect(doc.synopsis).toBeTruthy();
      expect(doc.description.length).toBeGreaterThan(20);
      expect(Array.isArray(doc.options)).toBe(true);
      expect(doc.examples.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("covers all three categories", async () => {
    const docs = await loadAllDocs();
    const categories = new Set(docs.map((d) => d.category));
    expect(categories.has("input")).toBe(true);
    expect(categories.has("transform")).toBe(true);
    expect(categories.has("output")).toBe(true);
  });
});

describe("loadDocForCommand", () => {
  test("returns doc for existing command", async () => {
    const doc = await loadDocForCommand("grep");
    expect(doc).toBeDefined();
    expect(doc!.name).toBe("grep");
    expect(doc!.category).toBe("transform");
  });

  test("returns doc for fromcsv", async () => {
    const doc = await loadDocForCommand("fromcsv");
    expect(doc).toBeDefined();
    expect(doc!.name).toBe("fromcsv");
    expect(doc!.category).toBe("input");
  });

  test("returns undefined for nonexistent command", async () => {
    const doc = await loadDocForCommand("nonexistent");
    expect(doc).toBeUndefined();
  });
});

describe("docToHelpText", () => {
  const sampleDoc: CommandDoc = {
    name: "testcmd",
    category: "transform",
    synopsis: "recs testcmd [options] <expr>",
    description: "A test command that does test things for testing purposes.",
    options: [
      {
        flags: ["--verbose", "-v"],
        description: "Enable verbose output.",
      },
      {
        flags: ["--count", "-c"],
        description: "Number of items.",
        argument: "<N>",
      },
    ],
    examples: [
      {
        description: "Basic usage",
        command: "recs testcmd 'r.x > 1'",
      },
    ],
    seeAlso: ["grep", "eval"],
  };

  test("includes usage line", () => {
    const text = docToHelpText(sampleDoc);
    expect(text).toContain("Usage: recs testcmd [options] <expr>");
  });

  test("includes description", () => {
    const text = docToHelpText(sampleDoc);
    expect(text).toContain("A test command that does test things");
  });

  test("includes options", () => {
    const text = docToHelpText(sampleDoc);
    expect(text).toContain("Options:");
    expect(text).toContain("--verbose, -v");
    expect(text).toContain("--count, -c <N>");
    expect(text).toContain("Enable verbose output.");
  });

  test("includes examples", () => {
    const text = docToHelpText(sampleDoc);
    expect(text).toContain("Examples:");
    expect(text).toContain("Basic usage");
    expect(text).toContain("recs testcmd 'r.x > 1'");
  });

  test("includes see also", () => {
    const text = docToHelpText(sampleDoc);
    expect(text).toContain("See also: recs grep, recs eval");
  });

  test("handles doc without seeAlso", () => {
    const noSeeAlso: CommandDoc = { ...sampleDoc, seeAlso: undefined };
    const text = docToHelpText(noSeeAlso);
    expect(text).not.toContain("See also:");
  });

  test("handles doc without options", () => {
    const noOpts: CommandDoc = { ...sampleDoc, options: [] };
    const text = docToHelpText(noOpts);
    expect(text).not.toContain("Options:");
  });
});

describe("formatCommandList", () => {
  test("groups commands by category", async () => {
    const docs = await loadAllDocs();
    const text = formatCommandList(docs);
    expect(text).toContain("Input commands:");
    expect(text).toContain("Transform commands:");
    expect(text).toContain("Output commands:");
  });

  test("includes all known commands", async () => {
    const docs = await loadAllDocs();
    const text = formatCommandList(docs);
    expect(text).toContain("fromcsv");
    expect(text).toContain("grep");
    expect(text).toContain("tocsv");
    expect(text).toContain("collate");
    expect(text).toContain("toprettyprint");
  });

  test("includes help hint", async () => {
    const docs = await loadAllDocs();
    const text = formatCommandList(docs);
    expect(text).toContain("Run 'recs help <command>' for detailed help");
  });
});
