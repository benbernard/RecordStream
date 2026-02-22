import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import { RecordStream } from "../src/RecordStream.ts";
import type { Aggregator } from "../src/Aggregator.ts";

// Test aggregators
class CountAgg implements Aggregator<number> {
  initial() { return 0; }
  combine(s: number) { return s + 1; }
  squish(s: number) { return s; }
}

class SumAgg implements Aggregator<number> {
  field: string;
  constructor(field: string) { this.field = field; }
  initial() { return 0; }
  combine(s: number, r: Record) { return s + (Number(r.get(this.field)) || 0); }
  squish(s: number) { return s; }
}

describe("RecordStream", () => {
  describe("fromJsonLines", () => {
    test("creates stream from JSON lines string", async () => {
      const rs = RecordStream.fromJsonLines('{"a":1}\n{"a":2}\n{"a":3}');
      const arr = await rs.toArray();
      expect(arr.length).toBe(3);
      expect(arr[0]!.get("a")).toBe(1);
    });

    test("handles empty lines", async () => {
      const rs = RecordStream.fromJsonLines('{"a":1}\n\n{"a":2}\n');
      const arr = await rs.toArray();
      expect(arr.length).toBe(2);
    });
  });

  describe("fromJsonArray", () => {
    test("creates from JSON array string", async () => {
      const rs = RecordStream.fromJsonArray('[{"x":1},{"x":2}]');
      const arr = await rs.toArray();
      expect(arr.length).toBe(2);
    });

    test("creates from object array", async () => {
      const rs = RecordStream.fromJsonArray([{ x: 1 }, { x: 2 }]);
      const arr = await rs.toArray();
      expect(arr.length).toBe(2);
      expect(arr[0]!.get("x")).toBe(1);
    });
  });

  describe("fromCsv", () => {
    test("parses CSV with headers", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const rs = RecordStream.fromCsv(csv);
      const arr = await rs.toArray();
      expect(arr.length).toBe(2);
      expect(arr[0]!.get("name")).toBe("Alice");
      expect(arr[0]!.get("age")).toBe(30);
    });

    test("handles quoted CSV fields", async () => {
      const csv = 'name,bio\nAlice,"Has a, comma"\nBob,"Says ""hi"""';
      const rs = RecordStream.fromCsv(csv);
      const arr = await rs.toArray();
      expect(arr[0]!.get("bio")).toBe("Has a, comma");
      expect(arr[1]!.get("bio")).toBe('Says "hi"');
    });
  });

  describe("fromRecords", () => {
    test("wraps an array of records", async () => {
      const records = [new Record({ a: 1 }), new Record({ a: 2 })];
      const arr = await RecordStream.fromRecords(records).toArray();
      expect(arr.length).toBe(2);
    });
  });

  describe("empty", () => {
    test("creates an empty stream", async () => {
      const arr = await RecordStream.empty().toArray();
      expect(arr.length).toBe(0);
    });
  });

  describe("grep", () => {
    test("filters with function predicate", async () => {
      const rs = RecordStream.fromJsonArray([
        { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
      ]);
      const arr = await rs.grep((r) => (r.get("x") as number) > 2).toArray();
      expect(arr.length).toBe(2);
      expect(arr[0]!.get("x")).toBe(3);
    });

    test("filters with code snippet", async () => {
      const rs = RecordStream.fromJsonArray([
        { x: 1 }, { x: 2 }, { x: 3 },
      ]);
      const arr = await rs.grep("r.get('x') > 1").toArray();
      expect(arr.length).toBe(2);
    });
  });

  describe("eval", () => {
    test("modifies records with code snippet", async () => {
      const rs = RecordStream.fromJsonArray([
        { x: 1 }, { x: 2 },
      ]);
      const arr = await rs.eval("r.set('doubled', r.get('x') * 2)").toArray();
      expect(arr[0]!.get("doubled")).toBe(2);
      expect(arr[1]!.get("doubled")).toBe(4);
    });
  });

  describe("sort", () => {
    test("sorts by key ascending", async () => {
      const rs = RecordStream.fromJsonArray([
        { name: "Charlie" }, { name: "Alice" }, { name: "Bob" },
      ]);
      const arr = await rs.sort("name").toArray();
      expect(arr.map((r) => r.get("name"))).toEqual(["Alice", "Bob", "Charlie"]);
    });

    test("sorts numerically", async () => {
      const rs = RecordStream.fromJsonArray([
        { n: 10 }, { n: 2 }, { n: 20 },
      ]);
      const arr = await rs.sort("n=numeric").toArray();
      expect(arr.map((r) => r.get("n"))).toEqual([2, 10, 20]);
    });
  });

  describe("uniq", () => {
    test("removes consecutive duplicates", async () => {
      const rs = RecordStream.fromJsonArray([
        { g: "a", v: 1 }, { g: "a", v: 2 }, { g: "b", v: 3 },
      ]);
      const arr = await rs.uniq("g").toArray();
      expect(arr.length).toBe(2);
      expect(arr[0]!.get("g")).toBe("a");
      expect(arr[1]!.get("g")).toBe("b");
    });
  });

  describe("head / tail", () => {
    test("head takes first N records", async () => {
      const rs = RecordStream.fromJsonArray([
        { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
      ]);
      const arr = await rs.head(2).toArray();
      expect(arr.length).toBe(2);
      expect(arr.map((r) => r.get("x"))).toEqual([1, 2]);
    });

    test("tail skips first N records", async () => {
      const rs = RecordStream.fromJsonArray([
        { x: 1 }, { x: 2 }, { x: 3 }, { x: 4 },
      ]);
      const arr = await rs.tail(2).toArray();
      expect(arr.length).toBe(2);
      expect(arr.map((r) => r.get("x"))).toEqual([3, 4]);
    });
  });

  describe("map", () => {
    test("transforms each record", async () => {
      const rs = RecordStream.fromJsonArray([{ x: 1 }, { x: 2 }]);
      const arr = await rs
        .map((r) => new Record({ y: (r.get("x") as number) * 10 }))
        .toArray();
      expect(arr.map((r) => r.get("y"))).toEqual([10, 20]);
    });
  });

  describe("reverse", () => {
    test("reverses record order", async () => {
      const rs = RecordStream.fromJsonArray([
        { x: 1 }, { x: 2 }, { x: 3 },
      ]);
      const arr = await rs.reverse().toArray();
      expect(arr.map((r) => r.get("x"))).toEqual([3, 2, 1]);
    });
  });

  describe("decollate", () => {
    test("flattens array fields", async () => {
      const rs = RecordStream.fromJsonArray([
        { name: "test", tags: ["a", "b", "c"] },
      ]);
      const arr = await rs.decollate("tags").toArray();
      expect(arr.length).toBe(3);
      expect(arr.map((r) => r.get("tags"))).toEqual(["a", "b", "c"]);
      expect(arr[0]!.get("name")).toBe("test");
    });

    test("passes through non-array values", async () => {
      const rs = RecordStream.fromJsonArray([{ x: "scalar" }]);
      const arr = await rs.decollate("x").toArray();
      expect(arr.length).toBe(1);
    });
  });

  describe("concat", () => {
    test("chains two streams", async () => {
      const a = RecordStream.fromJsonArray([{ x: 1 }]);
      const b = RecordStream.fromJsonArray([{ x: 2 }]);
      const arr = await a.concat(b).toArray();
      expect(arr.length).toBe(2);
      expect(arr.map((r) => r.get("x"))).toEqual([1, 2]);
    });
  });

  describe("collate", () => {
    test("aggregates with grouping keys", async () => {
      const rs = RecordStream.fromJsonArray([
        { group: "A", val: 10 },
        { group: "B", val: 20 },
        { group: "A", val: 30 },
        { group: "B", val: 40 },
      ]);

      const aggrs = new Map<string, CountAgg | SumAgg>();
      aggrs.set("count", new CountAgg());
      aggrs.set("total", new SumAgg("val"));

      const arr = await rs
        .collate({ keys: ["group"], aggregators: aggrs })
        .toArray();

      expect(arr.length).toBe(2);
      const groupA = arr.find((r) => r.get("group") === "A")!;
      const groupB = arr.find((r) => r.get("group") === "B")!;
      expect(groupA.get("count")).toBe(2);
      expect(groupA.get("total")).toBe(40);
      expect(groupB.get("count")).toBe(2);
      expect(groupB.get("total")).toBe(60);
    });

    test("aggregates without grouping keys", async () => {
      const rs = RecordStream.fromJsonArray([
        { val: 1 }, { val: 2 }, { val: 3 },
      ]);
      const aggrs = new Map<string, CountAgg | SumAgg>();
      aggrs.set("count", new CountAgg());
      aggrs.set("sum", new SumAgg("val"));

      const arr = await rs
        .collate({ aggregators: aggrs })
        .toArray();

      expect(arr.length).toBe(1);
      expect(arr[0]!.get("count")).toBe(3);
      expect(arr[0]!.get("sum")).toBe(6);
    });
  });

  describe("terminal operations", () => {
    test("toJsonArray returns plain objects", async () => {
      const rs = RecordStream.fromJsonArray([{ a: 1 }, { b: 2 }]);
      const arr = await rs.toJsonArray();
      expect(arr).toEqual([{ a: 1 }, { b: 2 }]);
    });

    test("toJsonLines produces newline-delimited JSON", async () => {
      const rs = RecordStream.fromJsonArray([{ a: 1 }, { b: 2 }]);
      const lines = await rs.toJsonLines();
      const parsed = lines
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      expect(parsed).toEqual([{ a: 1 }, { b: 2 }]);
    });

    test("toCsv produces CSV output", async () => {
      const rs = RecordStream.fromJsonArray([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]);
      const csv = await rs.toCsv();
      const lines = csv.trim().split("\n");
      expect(lines[0]).toBe("name,age");
      expect(lines[1]).toBe("Alice,30");
      expect(lines[2]).toBe("Bob,25");
    });
  });

  describe("chained pipeline", () => {
    test("complex pipeline: filter -> eval -> sort -> head", async () => {
      const rs = RecordStream.fromJsonArray([
        { name: "Charlie", score: 75 },
        { name: "Alice", score: 90 },
        { name: "Bob", score: 85 },
        { name: "Dave", score: 60 },
      ]);

      const result = await rs
        .grep((r) => (r.get("score") as number) >= 75)
        .eval("r.set('grade', r.get('score') >= 85 ? 'A' : 'B')")
        .sort("name")
        .head(2)
        .toArray();

      expect(result.length).toBe(2);
      expect(result[0]!.get("name")).toBe("Alice");
      expect(result[0]!.get("grade")).toBe("A");
      expect(result[1]!.get("name")).toBe("Bob");
      expect(result[1]!.get("grade")).toBe("A");
    });
  });

  describe("async iterator", () => {
    test("supports for-await-of", async () => {
      const rs = RecordStream.fromJsonArray([{ x: 1 }, { x: 2 }]);
      const values: number[] = [];
      for await (const record of rs) {
        values.push(record.get("x") as number);
      }
      expect(values).toEqual([1, 2]);
    });
  });
});
