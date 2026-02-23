/**
 * Pipeline executor for the Explorer.
 *
 * executeToStage() walks the stage path from the input to the target stage,
 * finds the nearest cached result, and executes forward from there. Uses
 * createOperation() from chain.ts to instantiate operations programmatically.
 */

// Side-effect import: registers all operation factories so createOperation() works.
import "../../cli/dispatcher.ts";

import { createOperation } from "../../operations/transform/chain.ts";
import { Operation } from "../../Operation.ts";
import type { Record } from "../../Record.ts";
import { InterceptReceiver } from "./intercept-receiver.ts";
import { loadInputRecords, loadInputContent } from "./input-loader.ts";
import type {
  PipelineState,
  StageId,
  Stage,
  CachedResult,
} from "../model/types.ts";

/** Operations that consume bulk stdin content via parseContent(). */
const BULK_STDIN_OPS = new Set([
  "fromcsv",
  "fromjsonarray",
  "fromkv",
  "fromxml",
]);

/** Operations that are fully self-contained (no input needed). */
export const SELF_CONTAINED_OPS = new Set(["fromps", "fromdb", "frommongo"]);

/**
 * Check if an operation instance overrides acceptLine (line-oriented input op).
 */
function hasCustomAcceptLine(op: Operation): boolean {
  const proto = Object.getPrototypeOf(op) as { [key: string]: unknown };
  return (
    typeof proto["acceptLine"] === "function" &&
    proto["acceptLine"] !== Operation.prototype.acceptLine
  );
}

/**
 * Get the ordered path of stages from the root to the target stage,
 * following parentId links back to the beginning.
 */
export function getStagePath(
  state: PipelineState,
  targetStageId: StageId,
): Stage[] {
  const path: Stage[] = [];
  let currentId: StageId | null = targetStageId;

  while (currentId !== null) {
    const stage = state.stages.get(currentId);
    if (!stage) break;
    path.unshift(stage);
    currentId = stage.parentId;
  }

  return path;
}

/**
 * Find the index of the nearest cached ancestor in the stage path.
 * Returns -1 if no cached result exists (must start from input).
 */
function findNearestCacheInMap(
  cache: Map<string, CachedResult>,
  activeInputId: string,
  path: Stage[],
): number {
  for (let i = path.length - 1; i >= 0; i--) {
    const stage = path[i]!;
    const cacheKey = `${activeInputId}:${stage.id}`;
    if (cache.has(cacheKey)) {
      return i;
    }
  }
  return -1;
}

/**
 * Execute the pipeline from the input (or nearest cache) to the target stage.
 *
 * Returns a CachedResult with the intercepted records, field names, and metadata.
 * The result is also stored in state.cache.
 */
export interface ExecuteOptions {
  /**
   * Optional writable cache to use instead of state.cache.
   * When provided, intermediate results are written here instead of mutating
   * state.cache directly. This is important for React: mutating state.cache
   * defeats memo comparators that rely on identity checks.
   *
   * When omitted (default), state.cache is mutated directly for backward
   * compatibility with tests.
   */
  workingCache?: Map<string, CachedResult>;
}

export async function executeToStage(
  state: PipelineState,
  targetStageId: StageId,
  options?: ExecuteOptions,
): Promise<CachedResult> {
  const startTime = performance.now();
  const path = getStagePath(state, targetStageId);

  if (path.length === 0) {
    throw new Error(`Stage ${targetStageId} not found in pipeline`);
  }

  // Use the provided working cache (for React safety) or state.cache (for tests).
  const cache = options?.workingCache ?? state.cache;

  const input = state.inputs.get(state.activeInputId) ?? null;

  // Check if the pipeline actually needs an input source.
  // Self-contained ops (fromps, fromdb, frommongo) don't need one.
  const firstEnabled = path.find((s) => s.config.enabled);
  const pipelineNeedsInput =
    !firstEnabled || !SELF_CONTAINED_OPS.has(firstEnabled.config.operationName);
  if (pipelineNeedsInput && !input) {
    throw new Error(`Input ${state.activeInputId} not found`);
  }

  // Find nearest cached ancestor
  const cachedIndex = findNearestCacheInMap(cache, state.activeInputId, path);

  // Determine starting records and which stages to execute
  let currentRecords: Record[];
  let startIndex: number;

  if (cachedIndex >= 0) {
    const cachedStage = path[cachedIndex]!;
    const cacheKey = `${state.activeInputId}:${cachedStage.id}`;
    const cached = cache.get(cacheKey)!;
    currentRecords = cached.records;
    startIndex = cachedIndex + 1;
  } else {
    // No cache — check if first enabled stage is a transform (needs input records).
    // Also load input if all stages are disabled (firstEnabled is undefined) and
    // the target stage is a transform — disabled stages pass through input.
    const needsInputRecords =
      firstEnabled
        ? !isInputOperation(firstEnabled.config.operationName)
        : !isInputOperation(path[0]!.config.operationName);
    if (needsInputRecords) {
      if (!input) {
        throw new Error(`No input source for transform stage "${(firstEnabled ?? path[0]!).config.operationName}"`);
      }
      currentRecords = await loadInputRecords(input);
    } else {
      currentRecords = [];
    }
    startIndex = 0;
  }

  // Execute stages from startIndex to end of path
  for (let i = startIndex; i < path.length; i++) {
    const stage = path[i]!;

    if (!stage.config.enabled) {
      // Disabled stages pass through records unchanged
      continue;
    }

    const opName = stage.config.operationName;
    const interceptor = new InterceptReceiver();

    const op = createOperation(opName, [...stage.config.args], interceptor);

    if (isInputOperation(opName)) {
      // Input operations: handle the 3 patterns
      if (SELF_CONTAINED_OPS.has(opName)) {
        // Self-contained ops generate records on their own via finish()
      } else if (input) {
        await executeInputOp(op, opName, input, state);
      } else {
        throw new Error(`Input source required for operation "${opName}"`);
      }
    } else {
      // Transform/output operations: feed records from previous stage
      for (const record of currentRecords) {
        if (!op.acceptRecord(record)) break;
      }
    }

    op.finish();
    currentRecords = interceptor.records;

    // Cache this stage's result
    const elapsed = performance.now() - startTime;
    const result: CachedResult = {
      key: `${state.activeInputId}:${stage.id}`,
      stageId: stage.id,
      inputId: state.activeInputId,
      records: interceptor.records,
      spillFile: null,
      recordCount: interceptor.recordCount,
      fieldNames: [...interceptor.fieldNames],
      computedAt: Date.now(),
      sizeBytes: estimateSize(interceptor.records),
      computeTimeMs: elapsed,
    };

    cache.set(result.key, result);
  }

  // Return the final stage's cached result
  const targetCacheKey = `${state.activeInputId}:${targetStageId}`;
  const finalResult = cache.get(targetCacheKey);
  if (!finalResult) {
    // This can happen if the target stage was disabled — return empty result
    const elapsed = performance.now() - startTime;
    const emptyResult: CachedResult = {
      key: targetCacheKey,
      stageId: targetStageId,
      inputId: state.activeInputId,
      records: currentRecords,
      spillFile: null,
      recordCount: currentRecords.length,
      fieldNames: [...new Set(currentRecords.flatMap((r) => r.keys()))],
      computedAt: Date.now(),
      sizeBytes: estimateSize(currentRecords),
      computeTimeMs: elapsed,
    };
    cache.set(targetCacheKey, emptyResult);
    return emptyResult;
  }

  return finalResult;
}

/**
 * Check if an operation name is an input operation (produces records
 * from an external source rather than transforming piped records).
 */
function isInputOperation(opName: string): boolean {
  return (
    opName.startsWith("from") || SELF_CONTAINED_OPS.has(opName)
  );
}

/**
 * Execute an input operation, handling the three input patterns:
 * 1. Line-oriented (hasCustomAcceptLine): feed raw text lines
 * 2. Bulk-content (BULK_STDIN_OPS): call parseContent() with file content
 * 3. Self-contained (fromps, fromdb): just call finish() (handled by caller)
 */
async function executeInputOp(
  op: Operation,
  opName: string,
  input: { source: { kind: "file"; path: string } | { kind: "stdin-capture"; records: Record[] }; label: string; id: string },
  _state: PipelineState,
): Promise<void> {
  if (SELF_CONTAINED_OPS.has(opName)) {
    // Self-contained ops generate records on their own (finish triggers it)
    return;
  }

  if (BULK_STDIN_OPS.has(opName)) {
    // Bulk content ops need the raw file content
    const content = await loadInputContent(input);
    const opAny = op as unknown as { [key: string]: unknown };
    if (opName === "fromxml" && typeof opAny["parseXml"] === "function") {
      (opAny["parseXml"] as (xml: string) => void)(content);
    } else if (typeof opAny["parseContent"] === "function") {
      (opAny["parseContent"] as (content: string) => void)(content);
    }
    return;
  }

  if (hasCustomAcceptLine(op)) {
    // Line-oriented ops: feed raw text lines from the input
    if (input.source.kind === "file") {
      const content = await loadInputContent(input);
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed !== "") {
          if (!op.acceptLine(trimmed)) break;
        }
      }
    } else {
      // stdin-capture: convert records back to lines
      for (const record of input.source.records) {
        if (!op.acceptLine(record.toString())) break;
      }
    }
  }
}

/**
 * Rough estimate of memory size for an array of records.
 * Samples up to 10 records and extrapolates to avoid serializing every record.
 */
function estimateSize(records: Record[]): number {
  const len = records.length;
  if (len === 0) return 0;
  const sampleSize = Math.min(10, len);
  let sampleTotal = 0;
  for (let i = 0; i < sampleSize; i++) {
    sampleTotal += records[i]!.toString().length * 2; // rough: 2 bytes per char
  }
  return Math.round((sampleTotal / sampleSize) * len);
}
