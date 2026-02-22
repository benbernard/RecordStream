import { describe, test, expect } from "bun:test";
import { ToChart } from "../../../src/operations/output/tochart.ts";
import { testOutput } from "./testHelper.ts";

const stream = `{"uid":"syslog","ct":1}
{"uid":"messagebus","ct":1}
{"uid":"avahi","ct":2}
{"uid":"daemon","ct":1}
{"uid":"gdm","ct":1}
{"uid":"rtkit","ct":1}
{"uid":"haldaemon","ct":2}
{"uid":"root","ct":75}
{"uid":"bernard","ct":58}`;

const numericStream = `{"x":1,"y":10,"z":5}
{"x":2,"y":20,"z":15}
{"x":3,"y":15,"z":25}
{"x":4,"y":30,"z":20}
{"x":5,"y":25,"z":30}`;

describe("ToChart", () => {
  // ── dump-spec tests ─────────────────────────────────────────

  test("--dump-spec outputs metadata and fields", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--label-key", "uid", "--dump-spec"],
      stream
    );

    expect(actual).toContain("type: bar");
    expect(actual).toContain("width: 80");
    expect(actual).toContain("height: 20");
    expect(actual).toContain("label-key: uid");
    expect(actual).toContain("field: ct");
    expect(actual).toContain("color: true");
    expect(actual).toContain("syslog 1");
    expect(actual).toContain("root 75");
    expect(actual).toContain("bernard 58");
  });

  test("--dump-spec with custom dimensions and title", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--width", "120", "--height", "30", "--title", "My Chart", "--dump-spec"],
      stream
    );

    expect(actual).toContain("width: 120");
    expect(actual).toContain("height: 30");
    expect(actual).toContain("title: My Chart");
  });

  test("--dump-spec with chart type", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--type", "line", "--dump-spec"],
      stream
    );
    expect(actual).toContain("type: line");
  });

  test("--dump-spec with --no-color", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--no-color", "--dump-spec"],
      stream
    );
    expect(actual).toContain("color: false");
  });

  test("--dump-spec with multiple keys", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "y,z", "--dump-spec"],
      numericStream
    );
    expect(actual).toContain("field: y");
    expect(actual).toContain("field: z");
    expect(actual).toContain("10 5");
    expect(actual).toContain("30 20");
  });

  test("--dump-spec with --output-file", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--output-file", "test.svg", "--dump-spec"],
      stream
    );
    expect(actual).toContain("output-file: test.svg");
  });

  // ── Error handling ──────────────────────────────────────────

  test("invalid chart type throws", () => {
    expect(() =>
      testOutput(ToChart, ["--key", "ct", "--type", "pie"], stream)
    ).toThrow("Invalid chart type: pie");
  });

  test("missing key throws", () => {
    expect(() =>
      testOutput(ToChart, ["--type", "bar"], stream)
    ).toThrow("Must specify at least one field with --key");
  });

  test("scatter with single field shows error", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--type", "scatter", "--no-color"],
      stream
    );
    expect(actual).toContain("Scatter chart requires at least 2 fields");
  });

  // ── Bar chart rendering ─────────────────────────────────────

  test("bar chart renders output", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--label-key", "uid", "--no-color", "--width", "60"],
      stream
    );

    // Should contain labels
    expect(actual).toContain("syslog");
    expect(actual).toContain("root");
    expect(actual).toContain("bernard");
    // Should contain numeric values
    expect(actual).toContain("75");
    expect(actual).toContain("58");
    // Should contain bar characters
    expect(actual).toContain("█");
  });

  test("bar chart with title", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--label-key", "uid", "--no-color", "--title", "Login Counts"],
      stream
    );
    expect(actual).toContain("Login Counts");
  });

  test("bar chart with multiple series", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "y,z", "--label-key", "x", "--no-color"],
      numericStream
    );
    // Should have legend entries for both fields
    expect(actual).toContain("█ y");
    expect(actual).toContain("█ z");
    // Should have labels
    expect(actual).toContain("1");
    expect(actual).toContain("5");
  });

  // ── Line chart rendering ────────────────────────────────────

  test("line chart renders braille characters", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--type", "line", "--no-color", "--height", "12"],
      stream
    );

    // Should have Y-axis labels
    expect(actual).toContain("75");
    expect(actual).toContain("1");
    // Should have axis characters
    expect(actual).toContain("┤");
    expect(actual).toContain("└");
    expect(actual).toContain("─");
  });

  test("line chart with title and legend", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "y,z", "--type", "line", "--no-color", "--title", "Trends", "--height", "12"],
      numericStream
    );
    expect(actual).toContain("Trends");
    expect(actual).toContain("━━ y");
    expect(actual).toContain("━━ z");
  });

  // ── Scatter chart rendering ─────────────────────────────────

  test("scatter chart renders", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "x,y", "--type", "scatter", "--no-color", "--height", "12"],
      numericStream
    );

    // Should have Y-axis values
    expect(actual).toContain("30");
    expect(actual).toContain("10");
    // Should have axis characters
    expect(actual).toContain("┤");
    expect(actual).toContain("└");
  });

  // ── Sparkline rendering ─────────────────────────────────────

  test("sparkline renders block characters", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--type", "sparkline", "--no-color"],
      stream
    );

    // Should contain the field name
    expect(actual).toContain("ct");
    // Should contain min and max
    expect(actual).toContain("1");
    expect(actual).toContain("75");
    // Should contain vertical block characters
    expect(actual).toMatch(/[▁▂▃▄▅▆▇█]/);
  });

  test("sparkline with multiple fields", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "y,z", "--type", "sparkline", "--no-color"],
      numericStream
    );

    expect(actual).toContain("y");
    expect(actual).toContain("z");
  });

  test("sparkline with title", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--type", "sparkline", "--no-color", "--title", "Activity"],
      stream
    );
    expect(actual).toContain("Activity");
  });

  // ── Edge cases ──────────────────────────────────────────────

  test("empty input produces no output", () => {
    const actual = testOutput(ToChart, ["--key", "ct", "--no-color"], "");
    expect(actual).toBe("");
  });

  test("single record bar chart", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--no-color"],
      '{"ct":42}'
    );
    expect(actual).toContain("42");
    expect(actual).toContain("█");
  });

  test("single record line chart", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--type", "line", "--no-color", "--height", "8"],
      '{"ct":42}'
    );
    expect(actual).toContain("42");
  });

  test("handles non-numeric values as zero", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "uid", "--type", "sparkline", "--no-color"],
      stream
    );
    // uid is a string, so all values become 0 → min and max are same
    expect(actual).toContain("0");
  });

  test("records without label-key use index", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--no-color", "--width", "40"],
      '{"ct":10}\n{"ct":20}\n{"ct":30}'
    );
    // Labels should be 1, 2, 3
    expect(actual).toContain("1");
    expect(actual).toContain("2");
    expect(actual).toContain("3");
  });

  // ── Color behavior ─────────────────────────────────────────

  test("color mode includes ANSI escape codes", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--color"],
      '{"ct":42}'
    );
    expect(actual).toContain("\x1b[");
  });

  test("no-color mode excludes ANSI escape codes", () => {
    const actual = testOutput(
      ToChart,
      ["--key", "ct", "--no-color"],
      '{"ct":42}'
    );
    expect(actual).not.toContain("\x1b[");
  });
});
