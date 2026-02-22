import { describe, test, expect } from "bun:test";
import { Record } from "../src/Record.ts";
import { OutputStream } from "../src/OutputStream.ts";

describe("OutputStream", () => {
  describe("recordToString", () => {
    test("converts record to JSON string", () => {
      const record = new Record({ a: 1, b: "hello" });
      const str = OutputStream.recordToString(record);
      const parsed = JSON.parse(str);
      expect(parsed).toEqual({ a: 1, b: "hello" });
    });
  });

  describe("write to custom stream", () => {
    test("writes JSON lines to writable stream", async () => {
      const chunks: string[] = [];
      const writable = new WritableStream<string>({
        write(chunk) {
          chunks.push(chunk);
        },
      });

      const output = new OutputStream(writable);
      await output.write(new Record({ x: 1 }));
      await output.write(new Record({ x: 2 }));
      await output.close();

      expect(chunks.length).toBe(2);
      expect(JSON.parse(chunks[0]!.trim())).toEqual({ x: 1 });
      expect(JSON.parse(chunks[1]!.trim())).toEqual({ x: 2 });
    });
  });

  describe("writeLine", () => {
    test("writes raw line to stream", async () => {
      const chunks: string[] = [];
      const writable = new WritableStream<string>({
        write(chunk) {
          chunks.push(chunk);
        },
      });

      const output = new OutputStream(writable);
      await output.writeLine("hello world");
      await output.close();

      expect(chunks[0]).toBe("hello world\n");
    });

    test("does not double-add newline", async () => {
      const chunks: string[] = [];
      const writable = new WritableStream<string>({
        write(chunk) {
          chunks.push(chunk);
        },
      });

      const output = new OutputStream(writable);
      await output.writeLine("hello\n");
      await output.close();

      expect(chunks[0]).toBe("hello\n");
    });
  });
});
