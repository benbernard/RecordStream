import { describe, test, expect } from "bun:test";
import { InputStream } from "../src/InputStream.ts";

describe("InputStream", () => {
  describe("fromString", () => {
    test("reads records from JSON lines string", async () => {
      const input = '{"a":1}\n{"a":2}\n{"a":3}';
      const stream = InputStream.fromString(input);
      const records = await stream.toArray();
      expect(records.length).toBe(3);
      expect(records[0]!.get("a")).toBe(1);
      expect(records[1]!.get("a")).toBe(2);
      expect(records[2]!.get("a")).toBe(3);
    });

    test("handles empty lines", async () => {
      const input = '{"a":1}\n\n{"a":2}\n';
      const stream = InputStream.fromString(input);
      const records = await stream.toArray();
      expect(records.length).toBe(2);
    });

    test("returns null when exhausted", async () => {
      const stream = InputStream.fromString('{"a":1}');
      const r1 = await stream.getRecord();
      expect(r1).not.toBeNull();
      const r2 = await stream.getRecord();
      expect(r2).toBeNull();
    });

    test("empty string produces no records", async () => {
      const stream = InputStream.fromString("");
      const records = await stream.toArray();
      expect(records.length).toBe(0);
    });
  });

  describe("chaining", () => {
    test("chains two string streams", async () => {
      const second = InputStream.fromString('{"x":3}');
      const first = InputStream.fromString('{"x":1}\n{"x":2}', second);
      const records = await first.toArray();
      expect(records.length).toBe(3);
      expect(records[0]!.get("x")).toBe(1);
      expect(records[1]!.get("x")).toBe(2);
      expect(records[2]!.get("x")).toBe(3);
    });

    test("chains three streams", async () => {
      const third = InputStream.fromString('{"n":3}');
      const second = InputStream.fromString('{"n":2}', third);
      const first = InputStream.fromString('{"n":1}', second);
      const records = await first.toArray();
      expect(records.length).toBe(3);
      expect(records.map((r) => r.get("n"))).toEqual([1, 2, 3]);
    });
  });

  describe("async iterator", () => {
    test("supports for-await-of", async () => {
      const stream = InputStream.fromString('{"v":1}\n{"v":2}');
      const values: number[] = [];
      for await (const record of stream) {
        values.push(record.get("v") as number);
      }
      expect(values).toEqual([1, 2]);
    });
  });

  describe("filename", () => {
    test("string input has STRING_INPUT filename", () => {
      const stream = InputStream.fromString('{"a":1}');
      expect(stream.getFilename()).toBe("STRING_INPUT");
    });
  });
});
