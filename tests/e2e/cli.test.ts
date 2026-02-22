import { describe, test, expect } from "bun:test";
import { join } from "node:path";

const RECS_BIN = join(import.meta.dir, "..", "..", "bin", "recs.ts");

interface RecsResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function recs(args: string[], stdin?: string): Promise<RecsResult> {
  const proc = Bun.spawn(["bun", RECS_BIN, ...args], {
    stdin: stdin ? new Buffer(stdin) : undefined,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

function parseRecords(stdout: string): Record<string, unknown>[] {
  return stdout
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// fromcsv
// ---------------------------------------------------------------------------
describe("fromcsv", () => {
  test("converts CSV with --header to JSON records", async () => {
    const csv = "name,age\nalice,30\nbob,25";
    const result = await recs(["fromcsv", "--header"], csv);
    expect(result.exitCode).toBe(0);
    const records = parseRecords(result.stdout);
    expect(records).toHaveLength(2);
    expect(records[0]!["name"]).toBe("alice");
    expect(records[0]!["age"]).toBe("30");
    expect(records[1]!["name"]).toBe("bob");
    expect(records[1]!["age"]).toBe("25");
  });

  test("converts CSV with --key to name fields", async () => {
    const csv = "alice,30\nbob,25";
    const result = await recs(["fromcsv", "--key", "name,age"], csv);
    expect(result.exitCode).toBe(0);
    const records = parseRecords(result.stdout);
    expect(records).toHaveLength(2);
    expect(records[0]!["name"]).toBe("alice");
    expect(records[0]!["age"]).toBe("30");
  });

  test("uses numeric keys when no field names given", async () => {
    const csv = "alice,30\nbob,25";
    const result = await recs(["fromcsv"], csv);
    expect(result.exitCode).toBe(0);
    const records = parseRecords(result.stdout);
    expect(records).toHaveLength(2);
    expect(records[0]!["0"]).toBe("alice");
    expect(records[0]!["1"]).toBe("30");
  });
});

// ---------------------------------------------------------------------------
// frommultire
// ---------------------------------------------------------------------------
describe("frommultire", () => {
  test("extracts fields from multi-line text with multiple regex patterns", async () => {
    const input = [
      "Name: Alice Smith",
      "Address: 123 Main St",
      "Name: Bob Jones",
      "Address: 456 Oak Ave",
    ].join("\n");

    const result = await recs(
      [
        "frommultire",
        "--re", "fname,lname=^Name: (.*) (.*)$",
        "--re", "addr=^Address: (.*)$",
      ],
      input,
    );
    expect(result.exitCode).toBe(0);
    const records = parseRecords(result.stdout);
    expect(records).toHaveLength(2);
    expect(records[0]!["fname"]).toBe("Alice");
    expect(records[0]!["lname"]).toBe("Smith");
    expect(records[0]!["addr"]).toBe("123 Main St");
    expect(records[1]!["fname"]).toBe("Bob");
    expect(records[1]!["lname"]).toBe("Jones");
    expect(records[1]!["addr"]).toBe("456 Oak Ave");
  });

  test("uses pre-flush regex to group fields into records", async () => {
    const input = [
      "Name: Alice",
      "Age: 30",
      "Name: Bob",
      "Age: 25",
    ].join("\n");

    const result = await recs(
      [
        "frommultire",
        "--pre", "name=^Name: (.*)$",
        "--re", "age=^Age: (.*)$",
      ],
      input,
    );
    expect(result.exitCode).toBe(0);
    const records = parseRecords(result.stdout);
    // pre-flush on Name means: flush accumulated fields before setting name.
    // First Name: Alice → flush (nothing), set name=Alice
    // Age: 30 → set age=30
    // Name: Bob → flush {name:Alice, age:30}, set name=Bob
    // Age: 25 → set age=25
    // EOF → flush {name:Bob, age:25}
    expect(records).toHaveLength(2);
    expect(records[0]!["name"]).toBe("Alice");
    expect(records[0]!["age"]).toBe("30");
    expect(records[1]!["name"]).toBe("Bob");
    expect(records[1]!["age"]).toBe("25");
  });
});

// ---------------------------------------------------------------------------
// grep
// ---------------------------------------------------------------------------
describe("grep", () => {
  test("filters records by JS expression", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
      JSON.stringify({ name: "charlie", age: 35 }),
    ].join("\n");

    const result = await recs(["grep", '{{age}} > 28'], records);
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(2);
    expect(output[0]!["name"]).toBe("alice");
    expect(output[1]!["name"]).toBe("charlie");
  });

  test("supports invert-match with -v", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
    ].join("\n");

    const result = await recs(["grep", "-v", '{{age}} > 28'], records);
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0]!["name"]).toBe("bob");
  });

  test("exits with 1 when no records match", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
    ].join("\n");

    const result = await recs(["grep", '{{age}} > 100'], records);
    expect(result.exitCode).toBe(1);
    expect(result.stdout.trim()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// eval
// ---------------------------------------------------------------------------
describe("eval", () => {
  test("evaluates expression and outputs text lines", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
    ].join("\n");

    const result = await recs(["eval", '{{name}} + " is " + {{age}}'], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("alice is 30");
    expect(lines[1]).toBe("bob is 25");
  });

  test("can compute values from record fields", async () => {
    const records = [
      JSON.stringify({ x: 10, y: 20 }),
      JSON.stringify({ x: 3, y: 4 }),
    ].join("\n");

    const result = await recs(["eval", "{{x}} + {{y}}"], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines[0]).toBe("30");
    expect(lines[1]).toBe("7");
  });
});

// ---------------------------------------------------------------------------
// xform
// ---------------------------------------------------------------------------
describe("xform", () => {
  test("adds computed fields to records", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: 30 }),
      JSON.stringify({ name: "bob", age: 25 }),
    ].join("\n");

    const result = await recs(["xform", 'r.set("double_age", r.get("age") * 2)'], records);
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(2);
    expect(output[0]!["double_age"]).toBe(60);
    expect(output[1]!["double_age"]).toBe(50);
  });

  test("emits multiple records from one input", async () => {
    const records = [
      JSON.stringify({ name: "alice" }),
    ].join("\n");

    const result = await recs(
      ["xform", 'return [{name: r.get("name"), copy: 1}, {name: r.get("name"), copy: 2}]'],
      records,
    );
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(2);
    expect(output[0]!["name"]).toBe("alice");
    expect(output[0]!["copy"]).toBe(1);
    expect(output[1]!["copy"]).toBe(2);
  });

  test("emits zero records for filtering", async () => {
    const records = [
      JSON.stringify({ name: "alice", keep: true }),
      JSON.stringify({ name: "bob", keep: false }),
    ].join("\n");

    const result = await recs(
      ["xform", 'if (!r.get("keep")) return []'],
      records,
    );
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0]!["name"]).toBe("alice");
  });
});

// ---------------------------------------------------------------------------
// collate
// ---------------------------------------------------------------------------
describe("collate", () => {
  test("groups by key with count aggregation", async () => {
    const records = [
      JSON.stringify({ dept: "eng", name: "alice" }),
      JSON.stringify({ dept: "eng", name: "bob" }),
      JSON.stringify({ dept: "sales", name: "charlie" }),
    ].join("\n");

    const result = await recs(
      ["collate", "-k", "dept", "-a", "count"],
      records,
    );
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(2);

    const eng = output.find((r) => r["dept"] === "eng");
    const sales = output.find((r) => r["dept"] === "sales");
    expect(eng).toBeDefined();
    expect(sales).toBeDefined();
    expect(eng!["count"]).toBe(2);
    expect(sales!["count"]).toBe(1);
  });

  test("groups by key with sum aggregation", async () => {
    const records = [
      JSON.stringify({ dept: "eng", salary: 100 }),
      JSON.stringify({ dept: "eng", salary: 120 }),
      JSON.stringify({ dept: "sales", salary: 90 }),
    ].join("\n");

    const result = await recs(
      ["collate", "-k", "dept", "-a", "total=sum,salary"],
      records,
    );
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(2);

    const eng = output.find((r) => r["dept"] === "eng");
    const sales = output.find((r) => r["dept"] === "sales");
    expect(eng!["total"]).toBe(220);
    expect(sales!["total"]).toBe(90);
  });

  test("works without grouping key (all records in one group)", async () => {
    const records = [
      JSON.stringify({ val: 10 }),
      JSON.stringify({ val: 20 }),
      JSON.stringify({ val: 30 }),
    ].join("\n");

    const result = await recs(["collate", "-a", "total=sum,val"], records);
    expect(result.exitCode).toBe(0);
    const output = parseRecords(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0]!["total"]).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// tocsv
// ---------------------------------------------------------------------------
describe("tocsv", () => {
  test("converts JSON records to CSV", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: "30" }),
      JSON.stringify({ name: "bob", age: "25" }),
    ].join("\n");

    const result = await recs(["tocsv"], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    // Header + 2 data rows
    expect(lines).toHaveLength(3);
    // Header should contain the field names
    expect(lines[0]).toContain("age");
    expect(lines[0]).toContain("name");
    // Data should contain values
    expect(result.stdout).toContain("alice");
    expect(result.stdout).toContain("bob");
  });

  test("respects --key for column selection", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: "30", city: "NYC" }),
      JSON.stringify({ name: "bob", age: "25", city: "LA" }),
    ].join("\n");

    const result = await recs(["tocsv", "--key", "name,age"], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines[0]).toBe("name,age");
    expect(lines[1]).toBe("alice,30");
    expect(lines[2]).toBe("bob,25");
    // city should not appear
    expect(result.stdout).not.toContain("city");
    expect(result.stdout).not.toContain("NYC");
  });

  test("supports --noheader", async () => {
    const records = [
      JSON.stringify({ name: "alice" }),
    ].join("\n");

    const result = await recs(["tocsv", "--noheader"], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("alice");
  });
});

// ---------------------------------------------------------------------------
// totable
// ---------------------------------------------------------------------------
describe("totable", () => {
  test("converts JSON records to ASCII table with header and data rows", async () => {
    const records = [
      JSON.stringify({ name: "alice", age: "30" }),
      JSON.stringify({ name: "bob", age: "25" }),
    ].join("\n");

    const result = await recs(["totable"], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    // Should have: header row, separator (dashes), data row 1, data row 2
    expect(lines.length).toBeGreaterThanOrEqual(4);
    // Header should contain field names
    expect(lines[0]).toContain("name");
    expect(lines[0]).toContain("age");
    // Second line should be dashes separator
    expect(lines[1]).toMatch(/-+/);
    // Data rows
    expect(result.stdout).toContain("alice");
    expect(result.stdout).toContain("bob");
  });

  test("supports --no-header", async () => {
    const records = [
      JSON.stringify({ name: "alice" }),
    ].join("\n");

    const result = await recs(["totable", "--no-header"], records);
    expect(result.exitCode).toBe(0);
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("alice");
    // Should NOT have dashes separator
    expect(result.stdout).not.toContain("---");
  });
});

// ---------------------------------------------------------------------------
// Pipeline tests
// ---------------------------------------------------------------------------
describe("pipelines", () => {
  test("fromcsv | grep | tocsv pipeline", async () => {
    const csv = "name,age\nalice,30\nbob,25\ncharlie,35";
    const step1 = await recs(["fromcsv", "--header"], csv);
    expect(step1.exitCode).toBe(0);

    const step2 = await recs(["grep", 'Number({{age}}) > 28'], step1.stdout);
    expect(step2.exitCode).toBe(0);

    const step3 = await recs(["tocsv"], step2.stdout);
    expect(step3.exitCode).toBe(0);
    expect(step3.stdout).toContain("alice");
    expect(step3.stdout).toContain("charlie");
    expect(step3.stdout).not.toContain("bob");
  });

  test("fromcsv | collate | totable pipeline", async () => {
    const csv = "dept,name\neng,alice\neng,bob\nsales,charlie";
    const step1 = await recs(["fromcsv", "--header"], csv);
    expect(step1.exitCode).toBe(0);

    const step2 = await recs(
      ["collate", "-k", "dept", "-a", "count"],
      step1.stdout,
    );
    expect(step2.exitCode).toBe(0);

    const step3 = await recs(["totable"], step2.stdout);
    expect(step3.exitCode).toBe(0);
    expect(step3.stdout).toContain("eng");
    expect(step3.stdout).toContain("sales");
    // Should show counts
    expect(step3.stdout).toContain("2");
    expect(step3.stdout).toContain("1");
  });

  test("fromcsv | eval | xform | tocsv complex pipeline", async () => {
    const csv = "item,price,qty\nwidget,10,3\ngadget,25,2\nthing,5,10";

    // Step 1: Parse CSV
    const step1 = await recs(["fromcsv", "--header"], csv);
    expect(step1.exitCode).toBe(0);

    // Step 2: Use xform to add a computed total field
    const step2 = await recs(
      ["xform", 'r.set("total", Number(r.get("price")) * Number(r.get("qty")))'],
      step1.stdout,
    );
    expect(step2.exitCode).toBe(0);
    const xformRecords = parseRecords(step2.stdout);
    expect(xformRecords[0]!["total"]).toBe(30);
    expect(xformRecords[1]!["total"]).toBe(50);
    expect(xformRecords[2]!["total"]).toBe(50);

    // Step 3: Collate to get the grand total
    const step3 = await recs(
      ["collate", "-a", "grand_total=sum,total"],
      step2.stdout,
    );
    expect(step3.exitCode).toBe(0);
    const collateRecords = parseRecords(step3.stdout);
    expect(collateRecords[0]!["grand_total"]).toBe(130);
  });

  test("fromcsv | grep | sort | tocsv pipeline", async () => {
    const csv = "name,score\nalice,85\nbob,92\ncharlie,78\ndiana,95";
    const step1 = await recs(["fromcsv", "--header"], csv);
    expect(step1.exitCode).toBe(0);

    // Filter scores above 80
    const step2 = await recs(["grep", 'Number({{score}}) > 80'], step1.stdout);
    expect(step2.exitCode).toBe(0);

    // Sort by score descending
    const step3 = await recs(["sort", "-k", "score=n"], step2.stdout);
    expect(step3.exitCode).toBe(0);

    const step4 = await recs(["tocsv", "--key", "name,score"], step3.stdout);
    expect(step4.exitCode).toBe(0);
    const lines = step4.stdout.trim().split("\n");
    // Header + 3 data rows (alice, bob, diana)
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("name,score");
    // Sorted ascending by numeric score: alice(85), bob(92), diana(95)
    expect(lines[1]).toContain("alice");
    expect(lines[3]).toContain("diana");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("error handling", () => {
  test("unknown command exits non-zero with helpful error", async () => {
    const result = await recs(["foobar"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown command");
    expect(result.stderr).toContain("foobar");
  });

  test("bad snippet syntax produces error message", async () => {
    const records = JSON.stringify({ x: 1 });
    const result = await recs(["grep", "invalid((("], records);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });

  test("--version prints version string", async () => {
    const result = await recs(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^recs \d+\.\d+\.\d+$/);
  });

  test("help lists available commands", async () => {
    const result = await recs(["help"]);
    expect(result.exitCode).toBe(0);
    // Should list several operations
    expect(result.stdout).toContain("fromcsv");
    expect(result.stdout).toContain("grep");
    expect(result.stdout).toContain("tocsv");
    expect(result.stdout).toContain("collate");
  });

  test("help for a specific command shows that command's help", async () => {
    const result = await recs(["help", "grep"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("grep");
    expect(result.stdout).toContain("expression");
  });

  test("help for unknown command exits with error", async () => {
    const result = await recs(["help", "nonexistent"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unknown command");
  });

  test("no arguments shows help", async () => {
    const result = await recs([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("fromcsv");
  });

  test("grep without expression produces error", async () => {
    const records = JSON.stringify({ x: 1 });
    const result = await recs(["grep"], records);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
