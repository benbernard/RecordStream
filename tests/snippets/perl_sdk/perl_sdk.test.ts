import { describe, test, expect } from "bun:test";
import { spawn } from "child_process";
import { join } from "path";
import type { JsonObject } from "../../../src/types/json.ts";

const RUNNER_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "src",
  "snippets",
  "perl",
  "runner.pl"
);

interface InboundMessage {
  type: string;
  data?: JsonObject;
  passed?: boolean;
  message?: string;
}

/**
 * Spawn the Perl runner and exchange JSONL messages.
 */
function runPerl(
  mode: string,
  code: string,
  records: JsonObject[]
): Promise<InboundMessage[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn("perl", [RUNNER_PATH], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";

    proc.stdout!.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr!.on("data", () => {
      // Consume stderr to prevent blocking
    });

    proc.on("error", (err) => reject(err));

    proc.on("close", () => {
      const lines = stdout
        .trim()
        .split("\n")
        .filter((l) => l.length > 0);
      const messages: InboundMessage[] = lines.map((l) => JSON.parse(l));
      resolve(messages);
    });

    // Send init
    proc.stdin!.write(
      JSON.stringify({ type: "init", code, mode }) + "\n"
    );

    // Send records
    for (const rec of records) {
      proc.stdin!.write(
        JSON.stringify({ type: "record", data: rec }) + "\n"
      );
    }

    // Send done and close stdin
    proc.stdin!.write(JSON.stringify({ type: "done" }) + "\n");
    proc.stdin!.end();
  });
}

// ----------------------------------------------------------------
// Eval mode
// ----------------------------------------------------------------

describe("Perl runner — eval mode", () => {
  test("returns the record unchanged", async () => {
    const msgs = await runPerl("eval", "$r", [
      { name: "alice", age: 30 },
    ]);

    const results = msgs.filter((m) => m.type === "result");
    expect(results).toHaveLength(1);
    expect(results[0]!.data).toEqual({ name: "alice", age: 30 });
  });

  test("modifies record in place", async () => {
    const msgs = await runPerl("eval", '$r->{age} = $r->{age} + 1', [
      { name: "alice", age: 30 },
    ]);

    const results = msgs.filter((m) => m.type === "result");
    expect(results).toHaveLength(1);
    expect(results[0]!.data).toEqual({ name: "alice", age: 31 });
  });

  test("handles multiple records", async () => {
    const msgs = await runPerl("eval", '$r->{x} = $r->{x} * 2', [
      { x: 1 },
      { x: 5 },
      { x: 10 },
    ]);

    const results = msgs.filter((m) => m.type === "result");
    expect(results).toHaveLength(3);
    expect(results[0]!.data).toEqual({ x: 2 });
    expect(results[1]!.data).toEqual({ x: 10 });
    expect(results[2]!.data).toEqual({ x: 20 });
  });

  test("$line increments", async () => {
    const msgs = await runPerl("eval", '$r->{line} = $line', [
      { a: 1 },
      { a: 2 },
      { a: 3 },
    ]);

    const results = msgs.filter((m) => m.type === "result");
    expect(results[0]!.data!["line"]).toBe(1);
    expect(results[1]!.data!["line"]).toBe(2);
    expect(results[2]!.data!["line"]).toBe(3);
  });

  test("nested hash access", async () => {
    const msgs = await runPerl(
      "eval",
      '$r->{flat} = $r->{a}{b}{c}',
      [{ a: { b: { c: 42 } } }]
    );

    const results = msgs.filter((m) => m.type === "result");
    expect(results[0]!.data!["flat"]).toBe(42);
  });

  test("record_done sent after each record", async () => {
    const msgs = await runPerl("eval", "$r", [{ a: 1 }, { a: 2 }]);
    const dones = msgs.filter((m) => m.type === "record_done");
    expect(dones).toHaveLength(2);
  });
});

// ----------------------------------------------------------------
// Grep mode
// ----------------------------------------------------------------

describe("Perl runner — grep mode", () => {
  test("filters with truthy expression", async () => {
    const msgs = await runPerl("grep", '$r->{age} > 25', [
      { name: "alice", age: 30 },
      { name: "bob", age: 20 },
      { name: "carol", age: 35 },
    ]);

    const filters = msgs.filter((m) => m.type === "filter");
    expect(filters).toHaveLength(3);
    expect(filters[0]!.passed).toBe(true);
    expect(filters[1]!.passed).toBe(false);
    expect(filters[2]!.passed).toBe(true);
  });

  test("string equality", async () => {
    const msgs = await runPerl("grep", '$r->{status} eq "active"', [
      { status: "active" },
      { status: "inactive" },
    ]);

    const filters = msgs.filter((m) => m.type === "filter");
    expect(filters[0]!.passed).toBe(true);
    expect(filters[1]!.passed).toBe(false);
  });

  test("regex match", async () => {
    const msgs = await runPerl("grep", '$r->{name} =~ /^a/i', [
      { name: "Alice" },
      { name: "Bob" },
    ]);

    const filters = msgs.filter((m) => m.type === "filter");
    expect(filters[0]!.passed).toBe(true);
    expect(filters[1]!.passed).toBe(false);
  });
});

// ----------------------------------------------------------------
// Xform mode
// ----------------------------------------------------------------

describe("Perl runner — xform mode", () => {
  test("modifies record in place (returned via $r)", async () => {
    const msgs = await runPerl("xform", '$r->{upper} = uc($r->{name})', [
      { name: "alice" },
    ]);

    const emits = msgs.filter((m) => m.type === "emit");
    expect(emits).toHaveLength(1);
    expect(emits[0]!.data).toEqual({ name: "alice", upper: "ALICE" });
  });

  test("push_record emits multiple records", async () => {
    const code =
      'push_record({ x => $r->{x} * 2 }); push_record({ x => $r->{x} * 3 })';
    const msgs = await runPerl("xform", code, [{ x: 10 }]);

    const emits = msgs.filter((m) => m.type === "emit");
    expect(emits).toHaveLength(2);
    expect(emits[0]!.data).toEqual({ x: 20 });
    expect(emits[1]!.data).toEqual({ x: 30 });
  });

  test("return arrayref emits multiple records", async () => {
    const code =
      '$r = [{ a => 1 }, { a => 2 }]';
    const msgs = await runPerl("xform", code, [{ original: 1 }]);

    const emits = msgs.filter((m) => m.type === "emit");
    expect(emits).toHaveLength(2);
    expect(emits[0]!.data).toEqual({ a: 1 });
    expect(emits[1]!.data).toEqual({ a: 2 });
  });
});

// ----------------------------------------------------------------
// Generate mode
// ----------------------------------------------------------------

describe("Perl runner — generate mode", () => {
  test("push_record emits new records", async () => {
    const code =
      'for my $i (1..3) { push_record({ idx => $i, src => $r->{name} }) }';
    const msgs = await runPerl("generate", code, [{ name: "alice" }]);

    const emits = msgs.filter((m) => m.type === "emit");
    expect(emits).toHaveLength(3);
    expect(emits[0]!.data).toEqual({ idx: 1, src: "alice" });
    expect(emits[1]!.data).toEqual({ idx: 2, src: "alice" });
    expect(emits[2]!.data).toEqual({ idx: 3, src: "alice" });
  });
});

// ----------------------------------------------------------------
// Error handling
// ----------------------------------------------------------------

describe("Perl runner — error handling", () => {
  test("compilation error sends error message", async () => {
    const msgs = await runPerl("eval", "this is not valid perl {{{", []);

    const errors = msgs.filter((m) => m.type === "error");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.message).toContain("Compilation error");
  });

  test("runtime error sends error but continues", async () => {
    // Calling a method on undef should produce a runtime error
    const msgs = await runPerl("eval", '$r->{result} = $r->{missing}->method()', [
      { a: 1 },
      { a: 2 },
    ]);

    // Should get record_done messages even after errors
    const dones = msgs.filter((m) => m.type === "record_done");
    expect(dones.length).toBeGreaterThanOrEqual(1);
  });
});

// ----------------------------------------------------------------
// Protocol correctness
// ----------------------------------------------------------------

describe("Perl runner — protocol", () => {
  test("messages alternate: result/filter/emit then record_done", async () => {
    const msgs = await runPerl("eval", "$r", [{ a: 1 }, { b: 2 }]);

    // Expect: result, record_done, result, record_done
    expect(msgs).toHaveLength(4);
    expect(msgs[0]!.type).toBe("result");
    expect(msgs[1]!.type).toBe("record_done");
    expect(msgs[2]!.type).toBe("result");
    expect(msgs[3]!.type).toBe("record_done");
  });

  test("empty record list produces no output", async () => {
    const msgs = await runPerl("eval", "$r", []);
    expect(msgs).toHaveLength(0);
  });
});
