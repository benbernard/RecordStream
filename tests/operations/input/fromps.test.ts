import { describe, test, expect } from "bun:test";
import { FromPs, type ProcessTableSource } from "../../../src/operations/input/fromps.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject, JsonValue } from "../../../src/types/json.ts";

class MockTable implements ProcessTableSource {
  getProcesses(): JsonObject[] {
    return [
      { uid: "1003", pid: 1, ppid: 0 },
      { uid: "1003", pid: 2, ppid: 1 },
      { uid: "1003", pid: 3, ppid: 0 },
      { uid: "1003", pid: 4, ppid: 2 },
    ];
  }

  getFields(): string[] {
    return ["uid", "pid", "ppid"];
  }
}

describe("FromPs", () => {
  test("produces records from mock process table with uid conversion", () => {
    const collector = new CollectorReceiver();
    const op = new FromPs(collector);
    op.setProcessTable(new MockTable());
    op.setUidConverter((_uid: JsonValue) => "bernard");
    op.init([]);
    op.finish();

    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { uid: "bernard", pid: 1, ppid: 0 },
      { uid: "bernard", pid: 2, ppid: 1 },
      { uid: "bernard", pid: 3, ppid: 0 },
      { uid: "bernard", pid: 4, ppid: 2 },
    ]);
  });

  test("default UID conversion converts uid field to username", () => {
    const collector = new CollectorReceiver();
    const op = new FromPs(collector);
    op.setProcessTable(new MockTable());
    // Don't call setUidConverter — let the default kick in
    op.init([]);
    op.finish();

    const result = collector.records.map((r) => r.toJSON());
    // Default converter parses /etc/passwd; UID 1003 may or may not resolve.
    // But the uid field should be a string (either a username or the UID as string).
    for (const rec of result) {
      expect(typeof rec["uid"]).toBe("string");
    }
    // All records should have same uid since they all have uid "1003"
    const uids = new Set(result.map((r) => r["uid"]));
    expect(uids.size).toBe(1);
  });

  test("--no-uid-convert flag keeps uid as original value", () => {
    const collector = new CollectorReceiver();
    const op = new FromPs(collector);
    op.setProcessTable(new MockTable());
    op.init(["--no-uid-convert"]);
    op.finish();

    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { uid: "1003", pid: 1, ppid: 0 },
      { uid: "1003", pid: 2, ppid: 1 },
      { uid: "1003", pid: 3, ppid: 0 },
      { uid: "1003", pid: 4, ppid: 2 },
    ]);
  });

  test("euid field is also converted by default", () => {
    class MockTableWithEuid implements ProcessTableSource {
      getProcesses(): JsonObject[] {
        return [
          { uid: "1003", euid: "1003", pid: 1 },
        ];
      }
      getFields(): string[] {
        return ["uid", "euid", "pid"];
      }
    }

    const collector = new CollectorReceiver();
    const op = new FromPs(collector);
    op.setProcessTable(new MockTableWithEuid());
    op.setUidConverter((_uid: JsonValue) => "bernard");
    op.init([]);
    op.finish();

    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { uid: "bernard", euid: "bernard", pid: 1 },
    ]);
  });

  test("euid field is not converted with --no-uid-convert", () => {
    class MockTableWithEuid implements ProcessTableSource {
      getProcesses(): JsonObject[] {
        return [
          { uid: "1003", euid: "1003", pid: 1 },
        ];
      }
      getFields(): string[] {
        return ["uid", "euid", "pid"];
      }
    }

    const collector = new CollectorReceiver();
    const op = new FromPs(collector);
    op.setProcessTable(new MockTableWithEuid());
    op.init(["--no-uid-convert"]);
    op.finish();

    const result = collector.records.map((r) => r.toJSON());
    expect(result).toEqual([
      { uid: "1003", euid: "1003", pid: 1 },
    ]);
  });

  test("wantsInput returns false", () => {
    const op = new FromPs();
    op.setProcessTable(new MockTable());
    op.init([]);
    expect(op.wantsInput()).toBe(false);
  });
});
