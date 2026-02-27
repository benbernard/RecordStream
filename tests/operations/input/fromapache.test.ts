import { describe, test, expect } from "bun:test";
import { FromApache } from "../../../src/operations/input/fromapache.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";
import type { JsonObject } from "../../../src/types/json.ts";

function runFromApache(
  args: string[],
  lines: string[]
): JsonObject[] {
  const collector = new CollectorReceiver();
  const op = new FromApache(collector);
  op.init(args);
  for (const line of lines) {
    op.processLine(line);
  }
  op.finish();
  return collector.records.map((r) => r.toJSON());
}

describe("FromApache", () => {
  const combinedLine =
    '192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891 "-" "DoCoMo/2.0 P03B(c500;TB;W24H16)"';

  const escapedQuoteLine =
    '123.160.48.6 - - [22/Mar/2014:03:12:29 +0900] "GET /?a=\\"b\\" HTTP/1.1" 200 739 "-" "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; .NET CLR 1.1.4322; .NET CLR 2.0.50727; .NET CLR 3.0.04506.648; .NET CLR 3.5.21022; InfoPath.1; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729; .NET4.0C; .NET4.0E; OfficeLiveConnector.1.5; OfficeLivePatch.1.3)"';

  test("combined format with --fast", () => {
    const result = runFromApache(["--fast"], [combinedLine]);
    expect(result.length).toBe(1);
    const r = result[0]!;
    expect(r["rhost"]).toBe("192.168.0.1");
    expect(r["status"]).toBe("200");
    expect(r["bytes"]).toBe("9891");
    expect(r["method"]).toBe("GET");
    expect(r["path"]).toBe("/x/i.cgi/net/0000/");
    expect(r["proto"]).toBe("HTTP/1.1");
    expect(r["agent"]).toBe("DoCoMo/2.0 P03B(c500;TB;W24H16)");
    expect(r["date"]).toBe("07/Feb/2011");
    expect(r["time"]).toBe("10:59:59");
    expect(r["timezone"]).toBe("+0900");
    expect(r["datetime"]).toBe("07/Feb/2011:10:59:59 +0900");
  });

  test("default mode is fast", () => {
    const result = runFromApache([], [escapedQuoteLine]);
    expect(result.length).toBe(1);
    expect(result[0]!["rhost"]).toBe("123.160.48.6");
  });

  test("fast and strict conflict throws error", () => {
    expect(() => {
      const op = new FromApache();
      op.init(["--fast", "--strict"]);
    }).toThrow("only one option from 'strict' or 'fast' required");
  });

  test("strict mode parses combined format", () => {
    const result = runFromApache(["--strict"], [escapedQuoteLine]);
    expect(result.length).toBe(1);
    const r = result[0]!;
    expect(r["rhost"]).toBe("123.160.48.6");
    expect(r["status"]).toBe("200");
  });

  test("vhost_common format with strict", () => {
    const line =
      'example.com 192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891';
    const result = runFromApache(
      ["--strict", '["vhost_common"]'],
      [line]
    );
    expect(result.length).toBe(1);
    const r = result[0]!;
    expect(r["vhost"]).toBe("example.com");
    expect(r["rhost"]).toBe("192.168.0.1");
    expect(r["method"]).toBe("GET");
  });

  test("strict common format does not match vhost input", () => {
    const line =
      'example.com 192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891';
    const result = runFromApache(
      ["--strict", '["common"]'],
      [line]
    );
    expect(result.length).toBe(0);
  });

  test("--woothee parses user agent into ua_* fields", () => {
    const result = runFromApache(["--woothee"], [combinedLine]);
    expect(result.length).toBe(1);
    const r = result[0]!;
    // Basic fields still present
    expect(r["rhost"]).toBe("192.168.0.1");
    expect(r["agent"]).toBe("DoCoMo/2.0 P03B(c500;TB;W24H16)");
    // Woothee-parsed fields
    expect(r["ua_name"]).toBe("docomo");
    expect(r["ua_category"]).toBe("mobilephone");
    expect(r["ua_os"]).toBe("docomo");
    expect(r["ua_version"]).toBe("P03B");
    expect(r["ua_vendor"]).toBe("docomo");
    expect(r["ua_os_version"]).toBe("UNKNOWN");
  });

  test("--woothee with desktop browser user agent", () => {
    const line =
      '10.0.0.1 - user [15/Mar/2024:12:00:00 +0000] "GET /index.html HTTP/1.1" 200 1234 "http://example.com" "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36"';
    const result = runFromApache(["--woothee"], [line]);
    expect(result.length).toBe(1);
    const r = result[0]!;
    expect(r["ua_name"]).toBe("Chrome");
    expect(r["ua_category"]).toBe("pc");
    expect(r["ua_os"]).toBe("Windows 7");
    expect(r["ua_vendor"]).toBe("Google");
    expect(r["ua_version"]).toBe("47.0.2526.111");
    expect(r["ua_os_version"]).toBe("NT 6.1");
  });

  test("without --woothee, no ua_* fields are added", () => {
    const result = runFromApache([], [combinedLine]);
    expect(result.length).toBe(1);
    const r = result[0]!;
    expect(r["ua_name"]).toBeUndefined();
    expect(r["ua_category"]).toBeUndefined();
  });
});
