// Core types
export type { JsonValue, JsonObject, JsonArray, JsonPrimitive } from "./types/json.ts";

// Core classes
export { Record } from "./Record.ts";
export { RecordStream } from "./RecordStream.ts";
export type { CollateOptions } from "./RecordStream.ts";

// Key access
export { KeySpec, findKey, setKey, NoSuchKeyError, clearKeySpecCaches } from "./KeySpec.ts";
export { KeyGroups } from "./KeyGroups.ts";

// Stream I/O
export { InputStream } from "./InputStream.ts";
export { OutputStream } from "./OutputStream.ts";

// Operation framework
export { Operation, CollectorReceiver, PrinterReceiver } from "./Operation.ts";
export type { RecordReceiver, OptionDef } from "./Operation.ts";

// Code execution
export { Executor, transformCode } from "./Executor.ts";

// Snippet runners
export { createSnippetRunner } from "./snippets/index.ts";
export type { SnippetRunner, SnippetContext, SnippetResult, SnippetMode } from "./snippets/index.ts";
export type { SnippetOptions } from "./RecordStream.ts";

// Aggregation framework
export { aggregatorRegistry, makeAggregators, mapInitial, mapCombine, mapSquish } from "./Aggregator.ts";
export type { Aggregator, AnyAggregator } from "./Aggregator.ts";
export { Accumulator } from "./Accumulator.ts";

// Extension registries
export { BaseRegistry } from "./BaseRegistry.ts";
export type { RegistryEntry } from "./BaseRegistry.ts";
export { clumperRegistry } from "./Clumper.ts";
export type { Clumper, ClumperCallback, ClumperOptions } from "./Clumper.ts";
export { deaggregatorRegistry } from "./Deaggregator.ts";
export type { Deaggregator } from "./Deaggregator.ts";
