import type { Record } from "../../Record.ts";

export type StageId = string;
export type ForkId = string;
export type InputId = string;
export type CacheKey = string;

export interface StageConfig {
  operationName: string;
  args: string[];
  enabled: boolean;
}

export interface Stage {
  id: StageId;
  config: StageConfig;
  parentId: StageId | null;
  childIds: StageId[];
  forkId: ForkId;
  position: number;
}

export interface Fork {
  id: ForkId;
  name: string;
  forkPointStageId: StageId | null;
  parentForkId: ForkId | null;
  stageIds: StageId[];
  createdAt: number;
}

export interface InputSource {
  id: InputId;
  source:
    | { kind: "file"; path: string }
    | { kind: "stdin-capture"; records: Record[] };
  label: string;
}

export interface CachedResult {
  key: CacheKey;
  stageId: StageId;
  inputId: InputId;
  records: Record[];
  lines: string[];
  spillFile: string | null;
  recordCount: number;
  fieldNames: string[];
  computedAt: number;
  sizeBytes: number;
  computeTimeMs: number;
}

export interface CacheConfig {
  maxMemoryBytes: number;
  cachePolicy: "all" | "selective" | "none";
  pinnedStageIds: Set<StageId>;
}

export interface InspectorState {
  viewMode: "table" | "prettyprint" | "json" | "schema";
  scrollOffset: number;
  searchQuery: string | null;
  highlightedColumn: number | null;
}

export interface UndoEntry {
  label: string;
  snapshot: PipelineSnapshot;
  timestamp: number;
}

export interface PipelineSnapshot {
  stages: Map<StageId, Stage>;
  forks: Map<ForkId, Fork>;
  inputs: Map<InputId, InputSource>;
  activeInputId: InputId;
  activeForkId: ForkId;
  cursorStageId: StageId | null;
}

export interface PipelineState {
  stages: Map<StageId, Stage>;
  forks: Map<ForkId, Fork>;
  inputs: Map<InputId, InputSource>;
  activeInputId: InputId;
  activeForkId: ForkId;
  cursorStageId: StageId | null;
  focusedPanel: "pipeline" | "inspector";
  cache: Map<string, CachedResult>;
  cacheConfig: CacheConfig;
  inspector: InspectorState;
  executing: boolean;
  lastError: { stageId: StageId; message: string } | null;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  sessionId: string;
  sessionDir: string;
  sessionName?: string;
}

// ── Stage Deltas ─────────────────────────────────────────────────

export type StageKind = "filter" | "reorder" | "aggregate" | "transform" | "input";

export interface StageDelta {
  kind: StageKind;
  parentCount: number | null; // null for input stages or no parent cache
  outputCount: number;
  fieldsAdded: number;
  fieldsRemoved: number;
  isTextOutput?: boolean;
}

// ── Actions ───────────────────────────────────────────────────────

export type InputSourceType =
  | { kind: "file"; path: string }
  | { kind: "stdin-capture"; records: Record[] };

export type PipelineAction =
  // Structural (undoable)
  | { type: "ADD_STAGE"; afterStageId: StageId | null; config: StageConfig }
  | { type: "DELETE_STAGE"; stageId: StageId }
  | { type: "UPDATE_STAGE_ARGS"; stageId: StageId; args: string[] }
  | { type: "TOGGLE_STAGE"; stageId: StageId }
  | { type: "INSERT_STAGE_BEFORE"; beforeStageId: StageId; config: StageConfig }
  | { type: "CREATE_FORK"; name: string; atStageId: StageId }
  | { type: "DELETE_FORK"; forkId: ForkId }
  | { type: "ADD_INPUT"; source: InputSourceType; label: string }
  | { type: "REMOVE_INPUT"; inputId: InputId }
  | { type: "REORDER_STAGE"; stageId: StageId; direction: "up" | "down" }
  // Undo/Redo
  | { type: "UNDO" }
  | { type: "REDO" }
  // Non-undoable (UI/cache state)
  | { type: "MOVE_CURSOR"; direction: "up" | "down" }
  | { type: "SET_CURSOR"; stageId: StageId }
  | { type: "SWITCH_INPUT"; inputId: InputId }
  | { type: "SWITCH_FORK"; forkId: ForkId }
  | { type: "CACHE_RESULT"; inputId: InputId; stageId: StageId; result: CachedResult }
  | { type: "INVALIDATE_STAGE"; stageId: StageId }
  | { type: "PIN_STAGE"; stageId: StageId }
  | { type: "SET_CACHE_POLICY"; policy: "all" | "selective" | "none" }
  | { type: "SET_ERROR"; stageId: StageId; message: string }
  | { type: "CLEAR_ERROR" }
  | { type: "SET_EXECUTING"; executing: boolean }
  | { type: "TOGGLE_FOCUS" }
  | { type: "SET_VIEW_MODE"; viewMode: InspectorState["viewMode"] }
  | { type: "MOVE_COLUMN_HIGHLIGHT"; direction: "left" | "right"; fieldCount: number }
  | { type: "CLEAR_COLUMN_HIGHLIGHT" }
  | { type: "SET_SESSION_NAME"; name: string };

// ── File Size Warning ─────────────────────────────────────────────

export interface FileSizeWarning {
  path: string;
  fileBytes: number;
  estimatedRecords: number;
  projectedCacheBytes: number;
  acknowledged: boolean;
}

export const FILE_SIZE_THRESHOLDS = {
  warn: 100 * 1024 * 1024, // 100 MB
  danger: 1024 * 1024 * 1024, // 1 GB
} as const;

// ── Session Persistence ──────────────────────────────────────────

export interface CacheManifestEntry {
  key: string; // `${inputId}:${stageId}`
  cacheKey: CacheKey;
  recordCount: number;
  fieldNames: string[];
  sizeBytes: number;
  computedAt: number;
  computeTimeMs: number;
  file: string; // relative path to JSONL file in cache/ dir
}

export interface SessionFile {
  version: 1;
  sessionId: string;
  name?: string;
  createdAt: number;
  lastAccessedAt: number;
  pipeline: PipelineSnapshot;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  cacheConfig: CacheConfig;
  cacheManifest: CacheManifestEntry[];
}

export interface SessionMetadata {
  sessionId: string;
  name?: string;
  createdAt: number;
  lastAccessedAt: number;
  inputPaths: string[];
  stageCount: number;
  cacheSizeBytes: number;
  pipelineSummary: string;
}
