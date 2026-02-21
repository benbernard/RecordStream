import { describe, test, expect } from "bun:test";
import { spawn } from "child_process";
import path from "path";

const RUNNER_DIR = path.join(__dirname, "..", "..", "..", "src", "snippets", "python");
const RUNNER_PATH = path.join(RUNNER_DIR, "runner.py");

interface ProtocolMsg {
  type: string;
  data?: Record<string, unknown>;
  passed?: boolean;
  message?: string;
  [key: string]: unknown;
}

/**
 * Helper: spawn the Python runner, feed it JSONL messages, collect responses.
 */
function runSession(
  messages: Record<string, unknown>[]
): Promise<{ responses: ProtocolMsg[]; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [RUNNER_PATH], {
      cwd: RUNNER_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr!.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", reject);
    proc.on("close", () => {
      const responses: ProtocolMsg[] = [];
      for (const line of stdout.split("\n")) {
        const trimmed = line.trim();
        if (trimmed) {
          try {
            responses.push(JSON.parse(trimmed) as ProtocolMsg);
          } catch {
            // skip non-JSON lines
          }
        }
      }
      resolve({ responses, stderr });
    });

    // Write all messages
    for (const msg of messages) {
      proc.stdin!.write(JSON.stringify(msg) + "\n");
    }
    proc.stdin!.end();
  });
}

// ---- Helpers ----

function ofType(responses: ProtocolMsg[], type: string): ProtocolMsg[] {
  return responses.filter((r) => r.type === type);
}

// ---- Tests ----

describe("Python SDK runner (end-to-end)", () => {
  describe("grep mode", () => {
    test("passes matching records", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['age'] > 20", mode: "grep" },
        { type: "record", data: { name: "alice", age: 30 } },
        { type: "done" },
      ]);
      const filters = ofType(responses, "filter");
      expect(filters).toHaveLength(1);
      expect(filters[0]!.passed).toBe(true);
      expect(ofType(responses, "record_done")).toHaveLength(1);
    });

    test("rejects non-matching records", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['age'] > 50", mode: "grep" },
        { type: "record", data: { name: "alice", age: 30 } },
        { type: "done" },
      ]);
      const filters = ofType(responses, "filter");
      expect(filters).toHaveLength(1);
      expect(filters[0]!.passed).toBe(false);
    });

    test("handles multiple records", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['x'] > 5", mode: "grep" },
        { type: "record", data: { x: 10 } },
        { type: "record", data: { x: 3 } },
        { type: "record", data: { x: 8 } },
        { type: "done" },
      ]);
      const filters = ofType(responses, "filter");
      expect(filters).toHaveLength(3);
      expect(filters[0]!.passed).toBe(true);
      expect(filters[1]!.passed).toBe(false);
      expect(filters[2]!.passed).toBe(true);
    });
  });

  describe("eval mode", () => {
    test("expression — mutates record", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['doubled'] = r['val'] * 2", mode: "eval" },
        { type: "record", data: { val: 21 } },
        { type: "done" },
      ]);
      const results = ofType(responses, "result");
      expect(results).toHaveLength(1);
      expect(results[0]!.data!["val"]).toBe(21);
      expect(results[0]!.data!["doubled"]).toBe(42);
    });

    test("preserves original fields", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['new_field'] = 'hi'", mode: "eval" },
        { type: "record", data: { existing: true } },
        { type: "done" },
      ]);
      const results = ofType(responses, "result");
      expect(results[0]!.data!["existing"]).toBe(true);
      expect(results[0]!.data!["new_field"]).toBe("hi");
    });
  });

  describe("xform mode", () => {
    test("emit multiple records", async () => {
      const { responses } = await runSession([
        {
          type: "init",
          code: "emit({'a': 1})\nemit({'b': 2})",
          mode: "xform",
        },
        { type: "record", data: { name: "input" } },
        { type: "done" },
      ]);
      const emits = ofType(responses, "emit");
      expect(emits).toHaveLength(2);
      expect(emits[0]!.data!["a"]).toBe(1);
      expect(emits[1]!.data!["b"]).toBe(2);
    });

    test("emit zero records drops input", async () => {
      const { responses } = await runSession([
        { type: "init", code: "pass", mode: "xform" },
        { type: "record", data: { name: "dropped" } },
        { type: "done" },
      ]);
      expect(ofType(responses, "emit")).toHaveLength(0);
      expect(ofType(responses, "record_done")).toHaveLength(1);
    });

    test("emit Record objects", async () => {
      const { responses } = await runSession([
        {
          type: "init",
          code: "emit(Record({'created': True}))",
          mode: "xform",
        },
        { type: "record", data: {} },
        { type: "done" },
      ]);
      const emits = ofType(responses, "emit");
      expect(emits).toHaveLength(1);
      expect(emits[0]!.data!["created"]).toBe(true);
    });
  });

  describe("generate mode", () => {
    test("generates from input", async () => {
      const { responses } = await runSession([
        {
          type: "init",
          code: "for i in range(3):\n    emit({'i': i, 'src': r['name']})",
          mode: "generate",
        },
        { type: "record", data: { name: "origin" } },
        { type: "done" },
      ]);
      const emits = ofType(responses, "emit");
      expect(emits).toHaveLength(3);
      expect(emits[0]!.data!["i"]).toBe(0);
      expect(emits[2]!.data!["src"]).toBe("origin");
    });
  });

  describe("error handling", () => {
    test("syntax error in snippet", async () => {
      const { responses } = await runSession([
        { type: "init", code: "def (bad", mode: "eval" },
      ]);
      const errors = ofType(responses, "error");
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(String(errors[0]!.message)).toContain("SyntaxError");
    });

    test("runtime error sends error + record_done", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['missing']", mode: "grep" },
        { type: "record", data: { name: "alice" } },
        { type: "done" },
      ]);
      const errors = ofType(responses, "error");
      expect(errors.length).toBeGreaterThanOrEqual(1);
      // Should still get record_done so processing continues
      expect(ofType(responses, "record_done")).toHaveLength(1);
    });

    test("invalid mode returns error", async () => {
      const { responses } = await runSession([
        { type: "init", code: "pass", mode: "bad_mode" },
      ]);
      const errors = ofType(responses, "error");
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(String(errors[0]!.message)).toContain("Invalid mode");
    });

    test("continues after per-record error", async () => {
      const { responses } = await runSession([
        { type: "init", code: "r['age'] > 20", mode: "grep" },
        { type: "record", data: { name: "alice" } }, // no age → error
        { type: "record", data: { name: "bob", age: 30 } }, // ok
        { type: "done" },
      ]);
      const errors = ofType(responses, "error");
      const filters = ofType(responses, "filter");
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(filters.length).toBeGreaterThanOrEqual(1);
      expect(filters[0]!.passed).toBe(true);
    });
  });

  describe("protocol edge cases", () => {
    test("empty data field", async () => {
      const { responses } = await runSession([
        { type: "init", code: "True", mode: "grep" },
        { type: "record", data: {} },
        { type: "done" },
      ]);
      const filters = ofType(responses, "filter");
      expect(filters).toHaveLength(1);
      expect(filters[0]!.passed).toBe(true);
    });

    test("no records before done", async () => {
      const { responses } = await runSession([
        { type: "init", code: "True", mode: "grep" },
        { type: "done" },
      ]);
      // Should exit cleanly with no output
      expect(ofType(responses, "filter")).toHaveLength(0);
      expect(ofType(responses, "error")).toHaveLength(0);
    });
  });
});
