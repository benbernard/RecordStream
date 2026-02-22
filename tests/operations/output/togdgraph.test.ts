import { describe, test, expect } from "bun:test";
import { ToGdGraph } from "../../../src/operations/output/togdgraph.ts";
import { testOutput } from "./testHelper.ts";

describe("ToGdGraph", () => {
  const stream = `{"uid":"syslog","ct":1}
{"uid":"messagebus","ct":1}
{"uid":"avahi","ct":2}
{"uid":"daemon","ct":1}
{"uid":"gdm","ct":1}
{"uid":"rtkit","ct":1}
{"uid":"haldaemon","ct":2}
{"uid":"root","ct":75}
{"uid":"bernard","ct":58}`;

  test("--dump-use-spec outputs metadata and data", () => {
    const actual = testOutput(
      ToGdGraph,
      ["--key", "uid,ct", "--png-file", "TEMP-gd.png", "--dump-use-spec"],
      stream
    );

    expect(actual).toContain("type: scatter");
    expect(actual).toContain("width: 600");
    expect(actual).toContain("height: 300");
    expect(actual).toContain("output file: TEMP-gd.png");
    expect(actual).toContain("field: uid");
    expect(actual).toContain("field: ct");
    expect(actual).toContain("syslog 1");
    expect(actual).toContain("root 75");
    expect(actual).toContain("bernard 58");
  });

  test("invalid graph type throws", () => {
    expect(() =>
      testOutput(ToGdGraph, ["--key", "ct", "--type", "invalid", "--dump-use-spec"], stream)
    ).toThrow("Unsupported graph type: invalid");
  });

  test("line graph type", () => {
    const actual = testOutput(
      ToGdGraph,
      ["--key", "ct", "--type", "line", "--dump-use-spec"],
      stream
    );
    expect(actual).toContain("type: line");
  });

  test("bar graph type", () => {
    const actual = testOutput(
      ToGdGraph,
      ["--key", "ct", "--type", "bar", "--dump-use-spec"],
      stream
    );
    expect(actual).toContain("type: bar");
  });

  test("custom width and height", () => {
    const actual = testOutput(
      ToGdGraph,
      ["--key", "ct", "--width", "800", "--height", "400", "--dump-use-spec"],
      stream
    );
    expect(actual).toContain("width: 800");
    expect(actual).toContain("height: 400");
  });

  test("graph title and labels", () => {
    const actual = testOutput(
      ToGdGraph,
      [
        "--key", "ct",
        "--graph-title", "My Graph",
        "--label-x", "Users",
        "--label-y", "Count",
        "--dump-use-spec",
      ],
      stream
    );
    expect(actual).toContain("title: My Graph");
    expect(actual).toContain("x label: Users");
    expect(actual).toContain("y label: Count");
  });
});
