import { describe, test, expect } from "bun:test";
import { FromXferlog } from "../../../src/operations/input/fromxferlog.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromXferlog(lines: string[]): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromXferlog(collector);
  op.init([]);
  for (const line of lines) {
    op.processLine(line);
  }
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromXferlog", () => {
  test("parses xferlog lines", () => {
    const lines = [
      "Mon Oct  1 17:09:23 2001 0 127.0.0.1 2611 FILENAME a _ o r tmbranno ftp 0 * c",
      "Mon Oct  1 17:09:27 2001 0 127.0.0.1 22   NAMEFILE a _ o r tmbranno ftp 0 * c",
      "Mon Oct  1 17:09:27 2001 0 127.0.0.1 22   file with spaces in it.zip a _ o r tmbranno ftp 0 * c",
      "Mon Oct  1 17:09:31 2001 0 127.0.0.1 7276 p1774034_11i_zhs.zip a _ o r tmbranno ftp 0 * c",
    ];

    const result = runFromXferlog(lines);
    expect(result.length).toBe(4);

    // First record
    const r0 = result[0]!;
    expect(r0["file_size"]).toBe("2611");
    expect(r0["remote_host"]).toBe("127.0.0.1");
    expect(r0["filename"]).toBe("FILENAME");
    expect(r0["username"]).toBe("tmbranno");
    expect(r0["year"]).toBe("2001");
    expect(r0["month"]).toBe("Oct");
    expect(r0["day"]).toBe("1");
    expect(r0["current_time"]).toBe("17:09:23");
    expect(r0["direction"]).toBe("o");
    expect(r0["service_name"]).toBe("ftp");
    expect(r0["completion_status"]).toBe("c");
    expect(r0["transfer_type"]).toBe("a");

    // File with spaces
    const r2 = result[2]!;
    expect(r2["filename"]).toBe("file with spaces in it.zip");
    expect(r2["file_size"]).toBe("22");

    // Last record
    const r3 = result[3]!;
    expect(r3["filename"]).toBe("p1774034_11i_zhs.zip");
    expect(r3["file_size"]).toBe("7276");
  });
});
