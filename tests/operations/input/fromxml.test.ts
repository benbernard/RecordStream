import { describe, test, expect } from "bun:test";
import { FromXml } from "../../../src/operations/input/fromxml.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromXml(args: string[]): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromXml(collector);
  op.init(args);
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

function runFromXmlContent(
  args: string[],
  xml: string
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromXml(collector);
  op.init(args);
  op.parseXml(xml);
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromXml", () => {
  test("extract nested elements with --nested", () => {
    const result = runFromXml([
      "--element",
      "address",
      "--element",
      "logdir",
      "--nested",
      "file:tests/fixtures/xml1",
    ]);

    // Should find all address elements and the logdir attribute
    const addresses = result.filter((r) => r["element"] === "address");
    const logdirs = result.filter((r) => r["element"] === "logdir");

    expect(addresses.length).toBe(5);
    expect(logdirs.length).toBe(1);

    // Check address values
    expect(addresses[0]!["value"]).toBe("10.0.0.101");
    expect(addresses[1]!["value"]).toBe("10.0.1.101");
    expect(addresses[2]!["value"]).toBe("10.0.0.102");
    expect(addresses[3]!["value"]).toBe("10.0.0.103");
    expect(addresses[4]!["value"]).toBe("10.0.1.103");

    expect(logdirs[0]!["value"]).toBe("/var/log/foo/");
  });

  test("extract server elements", () => {
    const result = runFromXml([
      "--element",
      "server",
      "file:tests/fixtures/xml1",
    ]);

    expect(result.length).toBe(3);

    // First server (sahara)
    expect(result[0]!["name"]).toBe("sahara");
    expect(result[0]!["osname"]).toBe("solaris");
    expect(result[0]!["osversion"]).toBe("2.6");
    expect(result[0]!["address"]).toEqual(["10.0.0.101", "10.0.1.101"]);

    // Second server (gobi)
    expect(result[1]!["name"]).toBe("gobi");
    expect(result[1]!["osname"]).toBe("irix");

    // Third server (kalahari)
    expect(result[2]!["name"]).toBe("kalahari");
    expect(result[2]!["osname"]).toBe("linux");
    expect(result[2]!["address"]).toEqual(["10.0.0.103", "10.0.1.103"]);
  });

  test("simple XML parsing", () => {
    const xml = `<root><item name="a"><value>1</value></item><item name="b"><value>2</value></item></root>`;
    const result = runFromXmlContent(["--element", "item"], xml);
    expect(result.length).toBe(2);
    expect(result[0]!["name"]).toBe("a");
    expect(result[1]!["name"]).toBe("b");
  });

  test("element deduplication", () => {
    // Specifying the same element twice should deduplicate and produce
    // the same results as specifying it once
    const resultDuplicated = runFromXml([
      "--element",
      "server",
      "--element",
      "server",
      "file:tests/fixtures/xml1",
    ]);

    const resultSingle = runFromXml([
      "--element",
      "server",
      "file:tests/fixtures/xml1",
    ]);

    expect(resultDuplicated.length).toBe(3);
    expect(resultDuplicated).toEqual(resultSingle);
  });

  test("comma-separated element syntax", () => {
    // --element "server,inner" should match both <server> and <inner> elements,
    // equivalent to --element server --element inner
    const resultComma = runFromXml([
      "--element",
      "server,inner",
      "--nested",
      "file:tests/fixtures/xml1",
    ]);

    const resultSeparate = runFromXml([
      "--element",
      "server",
      "--element",
      "inner",
      "--nested",
      "file:tests/fixtures/xml1",
    ]);

    expect(resultComma).toEqual(resultSeparate);

    // Both should have an "element" field since multiple elements are specified
    for (const record of resultComma) {
      expect(record["element"]).toBeDefined();
      expect(["server", "inner"]).toContain(record["element"] as string);
    }
  });
});
