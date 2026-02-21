import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import { CollectorReceiver } from "../src/Operation.ts";
import { XformOperation } from "../src/operations/transform/xform.ts";
import { readFileSync } from "fs";
import { join } from "path";

const FIXTURES = join(import.meta.dir, "fixtures");

function readFixtureRecords(filename: string): Record[] {
  const content = readFileSync(join(FIXTURES, filename), "utf-8");
  return content
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => Record.fromJSON(l));
}

describe("FilenameKey", () => {
  test("--filename-key annotates records with source filename via xform", () => {
    // Port of Perl's FilenameKey.t: tests that --filename-key properly
    // annotates records with the file they came from.
    const collector = new CollectorReceiver();
    const op = new XformOperation(collector);
    // The expression is a no-op (just passes records through)
    op.init(["{{foo}} = {{foo}}"]);
    op.setFilenameKey("fn");

    // Simulate reading from testFile2
    const file2Path = "tests/fixtures/testFile2";
    op.updateCurrentFilename(file2Path);
    const records2 = readFixtureRecords("testFile2");
    for (const r of records2) {
      op.acceptRecord(r);
    }

    // Simulate reading from testFile3
    const file3Path = "tests/fixtures/testFile3";
    op.updateCurrentFilename(file3Path);
    const records3 = readFixtureRecords("testFile3");
    for (const r of records3) {
      op.acceptRecord(r);
    }

    op.finish();

    // testFile2 has 3 records, testFile3 has 5 records
    expect(collector.records.length).toBe(8);

    // First 3 records should have fn = testFile2 path
    for (let i = 0; i < 3; i++) {
      expect(collector.records[i]!.get("fn")).toBe(file2Path);
    }

    // Verify testFile2 record fields
    expect(collector.records[0]!.get("foo")).toBe(1);
    expect(collector.records[0]!.get("zap")).toBe("blah1");
    expect(collector.records[1]!.get("foo")).toBe(2);
    expect(collector.records[2]!.get("foo")).toBe(3);

    // Next 5 records should have fn = testFile3 path
    for (let i = 3; i < 8; i++) {
      expect(collector.records[i]!.get("fn")).toBe(file3Path);
    }

    // Verify testFile3 record fields
    expect(collector.records[3]!.get("value")).toBe("10.0.0.101");
    expect(collector.records[3]!.get("foo")).toBe("bar");
    expect(collector.records[3]!.get("element")).toBe("address");
  });

  test("filename-key works with passthrough operation", () => {
    const collector = new CollectorReceiver();
    const op = new XformOperation(collector);
    op.init(["{{x}} = {{x}}"]);
    op.setFilenameKey("source");

    op.updateCurrentFilename("file_a.jsonl");
    op.acceptRecord(new Record({ x: 1 }));
    op.acceptRecord(new Record({ x: 2 }));

    op.updateCurrentFilename("file_b.jsonl");
    op.acceptRecord(new Record({ x: 3 }));

    op.finish();

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("source")).toBe("file_a.jsonl");
    expect(collector.records[1]!.get("source")).toBe("file_a.jsonl");
    expect(collector.records[2]!.get("source")).toBe("file_b.jsonl");
  });

  test("filename-key can be changed mid-stream", () => {
    const collector = new CollectorReceiver();
    const op = new XformOperation(collector);
    op.init(["{{v}} = {{v}}"]);
    op.setFilenameKey("fn");

    const filenames = ["alpha.json", "beta.json", "gamma.json"];
    for (const fname of filenames) {
      op.updateCurrentFilename(fname);
      op.acceptRecord(new Record({ v: fname }));
    }

    op.finish();

    expect(collector.records.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(collector.records[i]!.get("fn")).toBe(filenames[i]);
    }
  });
});
