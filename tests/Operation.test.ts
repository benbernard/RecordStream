import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import {
  Operation,
  CollectorReceiver,
  type OptionDef,
} from "../src/Operation.ts";

// A simple test operation that passes all records through
class PassthroughOp extends Operation {
  init(_args: string[]): void {
    // no-op
  }

  acceptRecord(record: Record): boolean {
    return this.pushRecord(record);
  }
}

// A grep-like operation for testing
class FilterOp extends Operation {
  field = "";
  value: string | number = "";

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "field",
        short: "f",
        type: "string",
        handler: (v) => {
          this.field = v as string;
        },
        description: "field to filter on",
      },
      {
        long: "value",
        short: "v",
        type: "string",
        handler: (v) => {
          this.value = v as string;
        },
        description: "value to filter for",
      },
    ];
    this.parseOptions(args, defs);
  }

  acceptRecord(record: Record): boolean {
    if (String(record.get(this.field)) === String(this.value)) {
      return this.pushRecord(record);
    }
    return true;
  }
}

describe("Operation", () => {
  describe("passthrough", () => {
    test("forwards all records to next", () => {
      const collector = new CollectorReceiver();
      const op = new PassthroughOp(collector);
      op.init([]);

      op.acceptRecord(new Record({ a: 1 }));
      op.acceptRecord(new Record({ a: 2 }));
      op.finish();

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("a")).toBe(1);
      expect(collector.records[1]!.get("a")).toBe(2);
    });
  });

  describe("filter operation", () => {
    test("filters records by field value", () => {
      const collector = new CollectorReceiver();
      const op = new FilterOp(collector);
      op.init(["--field", "status", "--value", "active"]);

      op.acceptRecord(new Record({ name: "a", status: "active" }));
      op.acceptRecord(new Record({ name: "b", status: "inactive" }));
      op.acceptRecord(new Record({ name: "c", status: "active" }));
      op.finish();

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("name")).toBe("a");
      expect(collector.records[1]!.get("name")).toBe("c");
    });

    test("short options work", () => {
      const collector = new CollectorReceiver();
      const op = new FilterOp(collector);
      op.init(["-f", "x", "-v", "1"]);

      op.acceptRecord(new Record({ x: "1" }));
      op.acceptRecord(new Record({ x: "2" }));
      op.finish();

      expect(collector.records.length).toBe(1);
    });
  });

  describe("acceptLine", () => {
    test("parses JSON line and processes record", () => {
      const collector = new CollectorReceiver();
      const op = new PassthroughOp(collector);
      op.init([]);

      op.acceptLine('{"a":42}');
      op.finish();

      expect(collector.records.length).toBe(1);
      expect(collector.records[0]!.get("a")).toBe(42);
    });
  });

  describe("filename key", () => {
    test("annotates records with filename", () => {
      const collector = new CollectorReceiver();
      const op = new PassthroughOp(collector);
      op.init([]);
      op.setFilenameKey("source");
      op.updateCurrentFilename("test.json");

      op.acceptRecord(new Record({ a: 1 }));
      op.finish();

      expect(collector.records[0]!.get("source")).toBe("test.json");
    });
  });

  describe("option parsing", () => {
    test("--help sets wantsHelp", () => {
      const op = new FilterOp();
      op.init(["--help"]);
      expect(op.getWantsHelp()).toBe(true);
    });

    test("unknown option throws", () => {
      const op = new FilterOp();
      expect(() => op.init(["--bogus"])).toThrow("Unknown option");
    });

    test("--flag=value syntax", () => {
      const collector = new CollectorReceiver();
      const op = new FilterOp(collector);
      op.init(["--field=x", "--value=1"]);

      op.acceptRecord(new Record({ x: "1" }));
      op.acceptRecord(new Record({ x: "2" }));
      op.finish();

      expect(collector.records.length).toBe(1);
    });
  });

  describe("chained operations", () => {
    test("operations can be chained", () => {
      const collector = new CollectorReceiver();
      const op2 = new PassthroughOp(collector);
      op2.init([]);
      const op1 = new PassthroughOp(op2);
      op1.init([]);

      op1.acceptRecord(new Record({ a: 1 }));
      op1.finish();

      expect(collector.records.length).toBe(1);
    });
  });
});
