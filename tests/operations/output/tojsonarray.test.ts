import { describe, test, expect } from "bun:test";
import { ToJsonArray } from "../../../src/operations/output/tojsonarray.ts";
import { testOutput } from "./testHelper.ts";

describe("ToJsonArray", () => {
  test("basic: wraps records in JSON array", () => {
    const input = `{"a":1,"foo":"bar"}
{"a":2,"b":2}
{"c":3}
{"b":4}`;

    const expected = `[{"a":1,"foo":"bar"}
,{"a":2,"b":2}
,{"c":3}
,{"b":4}
]
`;

    const actual = testOutput(ToJsonArray, [], input);
    expect(actual).toBe(expected);
  });

  test("empty input produces empty array", () => {
    const actual = testOutput(ToJsonArray, [], "");
    expect(actual).toBe("[]\n");
  });

  test("single record", () => {
    const input = `{"x":1}`;
    const expected = `[{"x":1}
]
`;
    const actual = testOutput(ToJsonArray, [], input);
    expect(actual).toBe(expected);
  });
});
