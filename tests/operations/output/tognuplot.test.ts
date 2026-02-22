import { describe, test, expect } from "bun:test";
import { ToGnuplot } from "../../../src/operations/output/tognuplot.ts";
import { testOutput } from "./testHelper.ts";

describe("ToGnuplot", () => {
  const stream = `{"uid":"syslog","ct":1}
{"uid":"messagebus","ct":1}
{"uid":"avahi","ct":2}
{"uid":"daemon","ct":1}
{"uid":"gdm","ct":1}
{"uid":"rtkit","ct":1}
{"uid":"haldaemon","ct":2}
{"uid":"root","ct":75}
{"uid":"bernard","ct":58}`;

  test("--dump-to-screen with --lines", () => {
    const actual = testOutput(
      ToGnuplot,
      ["--dump-to-screen", "--key", "ct", "--lines", "--file", "TEMP_TEST_OUTPUT.png"],
      stream
    );

    // Should contain data lines
    expect(actual).toContain("1\n");
    expect(actual).toContain("75\n");
    expect(actual).toContain("58\n");

    // Should contain gnuplot script
    expect(actual).toContain("set terminal png");
    expect(actual).toContain("set output 'TEMP_TEST_OUTPUT.png'");
    expect(actual).toContain("set title 'ct'");
    expect(actual).toContain("set style data linespoints");
    expect(actual).toContain("plot 'screen' using");
  });

  test("--dump-to-screen with two fields", () => {
    const actual = testOutput(
      ToGnuplot,
      ["--dump-to-screen", "--key", "ct,uid"],
      `{"ct":1,"uid":10}
{"ct":2,"uid":20}`
    );

    expect(actual).toContain("1 10\n");
    expect(actual).toContain("2 20\n");
    expect(actual).toContain("using 1:2");
  });

  test("requires at least one field", () => {
    expect(() => testOutput(ToGnuplot, ["--dump-to-screen"], "")).toThrow(
      "Must specify at least one field"
    );
  });

  test("bargraph and lines are mutually exclusive", () => {
    expect(() =>
      testOutput(ToGnuplot, ["--dump-to-screen", "--key", "ct", "--bargraph", "--lines"], stream)
    ).toThrow("Must specify one of --bargraph or --lines");
  });

  test("adds .png extension if missing", () => {
    const actual = testOutput(
      ToGnuplot,
      ["--dump-to-screen", "--key", "ct", "--lines", "--file", "output"],
      stream
    );
    expect(actual).toContain("output.png");
  });

  test("--bargraph mode produces histogram style", () => {
    const actual = testOutput(
      ToGnuplot,
      ["--dump-to-screen", "--key", "ct", "--bargraph", "--file", "test.png"],
      stream
    );
    expect(actual).toContain("set style data histogram");
  });

  test("--title sets graph title", () => {
    const actual = testOutput(
      ToGnuplot,
      ["--dump-to-screen", "--key", "ct", "--lines", "--title", "My Graph"],
      stream
    );
    expect(actual).toContain("set title 'My Graph'");
  });

  test("--precommand adds commands before plot", () => {
    const actual = testOutput(
      ToGnuplot,
      ["--dump-to-screen", "--key", "ct", "--lines", "--precommand", 'set xlabel "foo"'],
      stream
    );
    expect(actual).toContain('set xlabel "foo"');
  });
});
