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

  test("wantsInput returns false", () => {
    const op = new FromPs();
    op.setProcessTable(new MockTable());
    op.init([]);
    expect(op.wantsInput()).toBe(false);
  });
});
