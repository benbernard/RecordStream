/**
 * Core JSON types used throughout RecordStream.
 * Records are fundamentally JSON objects flowing through pipelines.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
