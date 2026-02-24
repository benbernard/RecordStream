import { describe, test, expect, beforeAll } from "bun:test";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { FromXls } from "../../../src/operations/input/fromxls.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

const FIXTURES_DIR = join(import.meta.dir, "../../fixtures");
const BASIC_XLSX = join(FIXTURES_DIR, "data.xlsx");
const MULTI_SHEET_XLSX = join(FIXTURES_DIR, "data-sheets.xlsx");

async function createFixtures(): Promise<void> {
  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  // Basic single-sheet xlsx with headers
  const wb1 = new ExcelJS.Workbook();
  const ws1 = wb1.addWorksheet("Sheet1");
  ws1.addRow(["name", "age", "city"]);
  ws1.addRow(["Alice", 30, "NYC"]);
  ws1.addRow(["Bob", 25, "LA"]);
  await wb1.xlsx.writeFile(BASIC_XLSX);

  // Multi-sheet xlsx
  const wb2 = new ExcelJS.Workbook();
  const ws2a = wb2.addWorksheet("People");
  ws2a.addRow(["name", "role"]);
  ws2a.addRow(["Alice", "engineer"]);
  const ws2b = wb2.addWorksheet("Cities");
  ws2b.addRow(["city", "pop"]);
  ws2b.addRow(["NYC", 8000000]);
  ws2b.addRow(["LA", 4000000]);
  await wb2.xlsx.writeFile(MULTI_SHEET_XLSX);
}

async function runFromXls(args: string[]): Promise<JsonObject[]> {
  const collector = new CollectorReceiver();
  const op = new FromXls(collector);
  op.init(args);
  await op.finish();
  return collector.records.map((r) => r.toJSON());
}

beforeAll(async () => {
  await createFixtures();
});

describe("FromXls", () => {
  test("reads xlsx with headers from first row", async () => {
    const result = await runFromXls([BASIC_XLSX]);
    expect(result).toEqual([
      { name: "Alice", age: 30, city: "NYC" },
      { name: "Bob", age: 25, city: "LA" },
    ]);
  });

  test("--no-header uses numeric field names", async () => {
    const result = await runFromXls(["--no-header", BASIC_XLSX]);
    expect(result).toEqual([
      { "0": "name", "1": "age", "2": "city" },
      { "0": "Alice", "1": 30, "2": "NYC" },
      { "0": "Bob", "1": 25, "2": "LA" },
    ]);
  });

  test("--key overrides field names", async () => {
    const result = await runFromXls(["-k", "a,b,c", "--no-header", BASIC_XLSX]);
    expect(result).toEqual([
      { a: "name", b: "age", c: "city" },
      { a: "Alice", b: 30, c: "NYC" },
      { a: "Bob", b: 25, c: "LA" },
    ]);
  });

  test("--sheet reads a specific sheet", async () => {
    const result = await runFromXls(["--sheet", "Cities", MULTI_SHEET_XLSX]);
    expect(result).toEqual([
      { city: "NYC", pop: 8000000 },
      { city: "LA", pop: 4000000 },
    ]);
  });

  test("--all-sheets reads all sheets with sheet field", async () => {
    const result = await runFromXls(["--all-sheets", MULTI_SHEET_XLSX]);
    expect(result).toEqual([
      { name: "Alice", role: "engineer", sheet: "People" },
      { city: "NYC", pop: 8000000, sheet: "Cities" },
      { city: "LA", pop: 4000000, sheet: "Cities" },
    ]);
  });

  test("throws on missing sheet name", async () => {
    await expect(
      runFromXls(["--sheet", "NonExistent", BASIC_XLSX])
    ).rejects.toThrow("Sheet 'NonExistent' not found");
  });

  test("requires at least one file argument", () => {
    expect(() => {
      const op = new FromXls();
      op.init([]);
    }).toThrow("fromxls requires at least one file argument");
  });

  test("numbers are parsed as numbers", async () => {
    const result = await runFromXls([BASIC_XLSX]);
    expect(typeof result[0]!["age"]).toBe("number");
    expect(result[0]!["age"]).toBe(30);
  });
});
