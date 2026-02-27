import { describe, test, expect } from "bun:test";
import { Record } from "../../../src/Record.ts";
import { CollectorReceiver, HelpExit } from "../../../src/Operation.ts";
import { DecollateOperation } from "../../../src/operations/transform/decollate.ts";

function makeOp(args: string[]): { op: DecollateOperation; collector: CollectorReceiver } {
  const collector = new CollectorReceiver();
  const op = new DecollateOperation(collector);
  op.init(args);
  return { op, collector };
}

describe("DecollateOperation", () => {
  describe("split deaggregator", () => {
    test("applies deaggregator to split records", () => {
      const { op, collector } = makeOp(["--deaggregator", "split,hosts, ,host"]);

      op.acceptRecord(new Record({ hosts: "a b c", group: "g1" }));
      op.finish();

      expect(collector.records.length).toBe(3);
      // Each record should have the original fields plus the deaggregated field
      expect(collector.records[0]!.get("host")).toBe("a");
      expect(collector.records[0]!.get("group")).toBe("g1");
      expect(collector.records[1]!.get("host")).toBe("b");
      expect(collector.records[2]!.get("host")).toBe("c");
    });

    test("multiple input records", () => {
      const { op, collector } = makeOp(["--deaggregator", "split,items,-,item"]);

      op.acceptRecord(new Record({ items: "x-y" }));
      op.acceptRecord(new Record({ items: "a-b-c" }));
      op.finish();

      expect(collector.records.length).toBe(5);
    });
  });

  describe("unhash deaggregator", () => {
    test("splits hash into key-value records", () => {
      const { op, collector } = makeOp(["--deaggregator", "unhash,data,key,value"]);

      op.acceptRecord(new Record({ data: { a: 1, b: 2, c: 3 }, name: "test" }));
      op.finish();

      expect(collector.records.length).toBe(3);
      // Keys should be sorted
      expect(collector.records[0]!.get("key")).toBe("a");
      expect(collector.records[0]!.get("value")).toBe(1);
      expect(collector.records[0]!.get("name")).toBe("test");
      expect(collector.records[1]!.get("key")).toBe("b");
      expect(collector.records[1]!.get("value")).toBe(2);
      expect(collector.records[2]!.get("key")).toBe("c");
      expect(collector.records[2]!.get("value")).toBe(3);
    });

    test("splits hash with key only (no value field)", () => {
      const { op, collector } = makeOp(["--deaggregator", "unhash,data,key"]);

      op.acceptRecord(new Record({ data: { x: 10, y: 20 }, group: "g1" }));
      op.finish();

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("key")).toBe("x");
      expect(collector.records[0]!.get("group")).toBe("g1");
      expect(collector.records[1]!.get("key")).toBe("y");
      // value field should not be set
      expect(collector.records[0]!.get("value")).toBeUndefined();
    });

    test("returns no records for non-object", () => {
      const { op, collector } = makeOp(["--deaggregator", "unhash,data,key,value"]);

      op.acceptRecord(new Record({ data: "not a hash", name: "test" }));
      op.finish();

      expect(collector.records.length).toBe(0);
    });
  });

  describe("unarray deaggregator", () => {
    test("splits array into individual records", () => {
      const { op, collector } = makeOp(["--deaggregator", "unarray,items,item"]);

      op.acceptRecord(new Record({ items: [1, 2, 3], name: "test" }));
      op.finish();

      expect(collector.records.length).toBe(3);
      expect(collector.records[0]!.get("item")).toBe(1);
      expect(collector.records[0]!.get("name")).toBe("test");
      expect(collector.records[1]!.get("item")).toBe(2);
      expect(collector.records[2]!.get("item")).toBe(3);
    });

    test("handles array of objects", () => {
      const { op, collector } = makeOp(["--deaggregator", "unarray,items,item"]);

      op.acceptRecord(new Record({ items: [{ a: 1 }, { b: 2 }], group: "g1" }));
      op.finish();

      expect(collector.records.length).toBe(2);
      expect(collector.records[0]!.get("item")).toEqual({ a: 1 });
      expect(collector.records[0]!.get("group")).toBe("g1");
      expect(collector.records[1]!.get("item")).toEqual({ b: 2 });
    });

    test("returns no records for non-array", () => {
      const { op, collector } = makeOp(["--deaggregator", "unarray,items,item"]);

      op.acceptRecord(new Record({ items: "not an array", name: "test" }));
      op.finish();

      expect(collector.records.length).toBe(0);
    });
  });

  describe("chained deaggregators", () => {
    test("applies two deaggregators in sequence with colon separator", () => {
      const { op, collector } = makeOp([
        "--deaggregator", "split,hosts, ,host:split,host,.,part",
      ]);

      op.acceptRecord(new Record({ hosts: "a.b c.d", group: "g1" }));
      op.finish();

      // "a.b" splits to ["a", "b"], "c.d" splits to ["c", "d"]
      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("part")).toBe("a");
      expect(collector.records[0]!.get("group")).toBe("g1");
      expect(collector.records[1]!.get("part")).toBe("b");
      expect(collector.records[2]!.get("part")).toBe("c");
      expect(collector.records[3]!.get("part")).toBe("d");
    });

    test("applies multiple -d flags in sequence", () => {
      const { op, collector } = makeOp([
        "-d", "split,hosts, ,host",
        "-d", "split,host,.,part",
      ]);

      op.acceptRecord(new Record({ hosts: "a.b c.d" }));
      op.finish();

      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("part")).toBe("a");
      expect(collector.records[1]!.get("part")).toBe("b");
      expect(collector.records[2]!.get("part")).toBe("c");
      expect(collector.records[3]!.get("part")).toBe("d");
    });

    test("chains split then unhash", () => {
      // First split a field containing JSON-like values, then unhash the result
      const { op, collector } = makeOp([
        "-d", "unhash,data,key,value",
        "-d", "split,value,-,part",
      ]);

      op.acceptRecord(new Record({ data: { x: "a-b", y: "c-d" }, name: "test" }));
      op.finish();

      // unhash produces 2 records (x: "a-b", y: "c-d")
      // then split on each value produces 2 records each: 4 total
      expect(collector.records.length).toBe(4);
      expect(collector.records[0]!.get("key")).toBe("x");
      expect(collector.records[0]!.get("part")).toBe("a");
      expect(collector.records[0]!.get("name")).toBe("test");
      expect(collector.records[1]!.get("key")).toBe("x");
      expect(collector.records[1]!.get("part")).toBe("b");
      expect(collector.records[2]!.get("key")).toBe("y");
      expect(collector.records[2]!.get("part")).toBe("c");
      expect(collector.records[3]!.get("key")).toBe("y");
      expect(collector.records[3]!.get("part")).toBe("d");
    });

    test("chains unarray then split", () => {
      const { op, collector } = makeOp([
        "-d", "unarray,items,item",
        "-d", "split,item,-,part",
      ]);

      op.acceptRecord(new Record({ items: ["a-b", "c-d-e"], name: "test" }));
      op.finish();

      // unarray produces 2 records, then split on each
      // "a-b" -> ["a", "b"], "c-d-e" -> ["c", "d", "e"]
      expect(collector.records.length).toBe(5);
      expect(collector.records[0]!.get("part")).toBe("a");
      expect(collector.records[0]!.get("name")).toBe("test");
      expect(collector.records[1]!.get("part")).toBe("b");
      expect(collector.records[2]!.get("part")).toBe("c");
      expect(collector.records[3]!.get("part")).toBe("d");
      expect(collector.records[4]!.get("part")).toBe("e");
    });
  });

  describe("--show-deaggregator", () => {
    test("shows deaggregator usage", () => {
      const collector = new CollectorReceiver();
      const op = new DecollateOperation(collector);

      expect(() => op.init(["--show-deaggregator", "split"])).toThrow(HelpExit);
      try {
        op.init(["--show-deaggregator", "split"]);
      } catch (e) {
        expect((e as HelpExit).message).toContain("split");
      }
    });

    test("shows error for unknown deaggregator", () => {
      const collector = new CollectorReceiver();
      const op = new DecollateOperation(collector);

      expect(() => op.init(["--show-deaggregator", "nonexistent"])).toThrow(HelpExit);
      try {
        op.init(["--show-deaggregator", "nonexistent"]);
      } catch (e) {
        expect((e as HelpExit).message).toContain("Bad deaggregator");
      }
    });
  });

  describe("--list-deaggregators", () => {
    test("lists available deaggregators", () => {
      const collector = new CollectorReceiver();
      const op = new DecollateOperation(collector);

      expect(() => op.init(["--list-deaggregators"])).toThrow(HelpExit);
      try {
        op.init(["--list-deaggregators"]);
      } catch (e) {
        const msg = (e as HelpExit).message;
        expect(msg).toContain("split");
        expect(msg).toContain("unarray");
        expect(msg).toContain("unhash");
      }
    });
  });

  describe("--dldeaggregator", () => {
    test("works as alias for -d", () => {
      const { op, collector } = makeOp(["--dldeaggregator", "split,hosts, ,host"]);

      op.acceptRecord(new Record({ hosts: "a b c", group: "g1" }));
      op.finish();

      expect(collector.records.length).toBe(3);
      expect(collector.records[0]!.get("host")).toBe("a");
      expect(collector.records[0]!.get("group")).toBe("g1");
    });

    test("short flag -D works", () => {
      const { op, collector } = makeOp(["-D", "unarray,items,item"]);

      op.acceptRecord(new Record({ items: [1, 2, 3] }));
      op.finish();

      expect(collector.records.length).toBe(3);
      expect(collector.records[0]!.get("item")).toBe(1);
    });
  });
});
