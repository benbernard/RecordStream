import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver, Operation } from "../../../src/Operation.ts";
import type { RecordReceiver } from "../../../src/Operation.ts";
import {
  ChainOperation,
  registerOperationFactory,
} from "../../../src/operations/transform/chain.ts";

// Register a simple test operation
class DoubleFieldOp extends Operation {
  field = "x";

  init(args: string[]): void {
    if (args.length > 0) {
      this.field = args[0]!;
    }
  }

  acceptRecord(record: Record): boolean {
    const val = record.get(this.field);
    if (typeof val === "number") {
      record.set(this.field, val * 2);
    }
    return this.pushRecord(record);
  }
}

class AddFieldOp extends Operation {
  init(_args: string[]): void {
    // no-op
  }

  acceptRecord(record: Record): boolean {
    record.set("added", true);
    return this.pushRecord(record);
  }
}

registerOperationFactory("double", (next: RecordReceiver) => new DoubleFieldOp(next));
registerOperationFactory("add-field", (next: RecordReceiver) => new AddFieldOp(next));

describe("ChainOperation", () => {
  test("chains operations together", () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["double", "x", "|", "add-field"]);

    chain.feedRecords([
      new Record({ x: 5 }),
      new Record({ x: 10 }),
    ]);
    chain.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(10);
    expect(collector.records[0]!.get("added")).toBe(true);
    expect(collector.records[1]!.get("x")).toBe(20);
  });

  test("single operation in chain", () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["double", "x"]);

    chain.feedRecords([new Record({ x: 3 })]);
    chain.finish();

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(6);
  });

  test("empty chain does nothing", () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init([]);
    chain.finish();

    expect(collector.records.length).toBe(0);
  });
});

describe("ChainOperation with shell commands", () => {
  test("shell command pass-through with cat", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["cat"]);

    chain.feedRecords([
      new Record({ x: 1 }),
      new Record({ x: 2 }),
    ]);
    await chain.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(1);
    expect(collector.records[1]!.get("x")).toBe(2);
  });

  test("shell command with grep filter", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    // Use /usr/bin/grep to ensure shell command, not recs grep operation
    chain.init(["/usr/bin/grep", "foo"]);

    chain.feedRecords([
      new Record({ name: "foo" }),
      new Record({ name: "bar" }),
      new Record({ name: "foobar" }),
    ]);
    await chain.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("name")).toBe("foo");
    expect(collector.records[1]!.get("name")).toBe("foobar");
  });

  test("recs op then shell command", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["double", "x", "|", "cat"]);

    chain.feedRecords([
      new Record({ x: 5 }),
      new Record({ x: 10 }),
    ]);
    await chain.finish();

    expect(collector.records.length).toBe(2);
    expect(collector.records[0]!.get("x")).toBe(10);
    expect(collector.records[1]!.get("x")).toBe(20);
  });

  test("shell command then recs op", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["cat", "|", "double", "x"]);

    chain.feedRecords([
      new Record({ x: 3 }),
    ]);
    await chain.finish();

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(6);
  });

  test("mixed recs and shell commands", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["double", "x", "|", "cat", "|", "add-field"]);

    chain.feedRecords([
      new Record({ x: 5 }),
    ]);
    await chain.finish();

    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(10);
    expect(collector.records[0]!.get("added")).toBe(true);
  });

  test("shell command with no input produces no output", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["cat"]);

    // Don't feed any records
    await chain.finish();

    expect(collector.records.length).toBe(0);
  });

  test("multiple records through shell command", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["cat"]);

    const records = [];
    for (let i = 0; i < 100; i++) {
      records.push(new Record({ i }));
    }
    chain.feedRecords(records);
    await chain.finish();

    expect(collector.records.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(collector.records[i]!.get("i")).toBe(i);
    }
  });

  test("early process exit (head -1) is handled gracefully", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["head", "-1"]);

    // Feed multiple records; head -1 only consumes the first line.
    // Due to pipe buffering, writes may succeed even after head exits,
    // so we just verify no crash and correct output.
    chain.feedRecords([
      new Record({ x: 1 }),
      new Record({ x: 2 }),
      new Record({ x: 3 }),
    ]);

    await chain.finish();

    // head -1 should produce exactly one record
    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(1);
  });

  test("shell command failure does not crash", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["bash", "-c", "exit 1"]);

    chain.feedRecords([new Record({ x: 1 })]);
    await chain.finish();

    // The command exits with non-zero, but chain should not throw
    // No output expected since the command doesn't produce any
    expect(collector.records.length).toBe(0);
  });

  test("stderr output is forwarded", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["bash", "-c", "echo stderr-msg >&2 && cat"]);

    // Capture stderr
    const stderrChunks: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: Uint8Array | string): boolean => {
      stderrChunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    };

    try {
      chain.feedRecords([new Record({ x: 1 })]);
      await chain.finish();
    } finally {
      process.stderr.write = origWrite;
    }

    // Verify stderr was forwarded
    const allStderr = stderrChunks.join("");
    expect(allStderr).toContain("stderr-msg");

    // And stdout still works (cat passes through the record)
    expect(collector.records.length).toBe(1);
    expect(collector.records[0]!.get("x")).toBe(1);
  });

  test("malformed JSON in shell output is pushed as a line", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    // Echo non-JSON text instead of passing through records
    chain.init(["bash", "-c", "echo 'not json'; echo 'also not json'"]);

    chain.feedRecords([new Record({ x: 1 })]);
    await chain.finish();

    // Non-JSON lines should be pushed as lines, not crash
    expect(collector.lines.length).toBe(2);
    expect(collector.lines[0]).toBe("not json");
    expect(collector.lines[1]).toBe("also not json");
  });

  test("incremental record arrival via acceptRecord", async () => {
    const collector = new CollectorReceiver();
    const chain = new ChainOperation(collector);
    chain.init(["cat"]);

    // Feed records one at a time instead of batch
    chain.acceptRecord(new Record({ i: 0 }));
    chain.acceptRecord(new Record({ i: 1 }));
    chain.acceptRecord(new Record({ i: 2 }));

    await chain.finish();

    expect(collector.records.length).toBe(3);
    expect(collector.records[0]!.get("i")).toBe(0);
    expect(collector.records[1]!.get("i")).toBe(1);
    expect(collector.records[2]!.get("i")).toBe(2);
  });
});
