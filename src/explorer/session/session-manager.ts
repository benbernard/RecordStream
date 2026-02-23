/**
 * Session manager for Explorer pipeline builder.
 *
 * Handles saving, loading, listing, and cleaning sessions stored at
 * ~/.config/recs-explorer/sessions/<sessionId>/. Each session directory contains:
 *   - session.json: pipeline structure, undo/redo, cache manifest
 *   - cache/: JSONL files for cached stage results
 *   - meta.json: session metadata for listing/discovery
 */

import { join, basename } from "node:path";
import { homedir } from "node:os";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import type {
  PipelineState,
  SessionFile,
  SessionMetadata,
  CacheConfig,
  PipelineSnapshot,
  UndoEntry,
} from "../model/types.ts";
import { extractSnapshot } from "../model/undo.ts";
import { SessionCacheStore } from "./session-cache-store.ts";

const SESSIONS_BASE_DIR = join(homedir(), ".config", "recs-explorer", "sessions");
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get the base directory where all sessions are stored.
 */
export function getSessionsBaseDir(): string {
  return SESSIONS_BASE_DIR;
}

export class SessionManager {
  readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? SESSIONS_BASE_DIR;
  }

  /**
   * Get the directory path for a specific session.
   */
  sessionDir(sessionId: string): string {
    return join(this.baseDir, sessionId);
  }

  /**
   * Save the current pipeline state as a session on disk.
   * Creates/overwrites session.json and meta.json, and writes cache files.
   */
  async save(state: PipelineState): Promise<void> {
    const dir = this.sessionDir(state.sessionId);
    await mkdir(dir, { recursive: true });

    const cacheStore = new SessionCacheStore(dir);
    const cacheManifest = await cacheStore.writeAllCaches(state.cache);

    const snapshot = extractSnapshot(state);
    const sessionFile: SessionFile = {
      version: 1,
      sessionId: state.sessionId,
      name: state.sessionName,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      pipeline: serializeSnapshot(snapshot),
      undoStack: state.undoStack.map(serializeUndoEntry),
      redoStack: state.redoStack.map(serializeUndoEntry),
      cacheConfig: serializeCacheConfig(state.cacheConfig),
      cacheManifest,
    };

    await Bun.write(
      join(dir, "session.json"),
      JSON.stringify(sessionFile, jsonReplacer, 2),
    );

    const metadata = buildMetadata(state, cacheManifest);
    await Bun.write(
      join(dir, "meta.json"),
      JSON.stringify(metadata, null, 2),
    );
  }

  /**
   * Save the current pipeline state under a new named session.
   * Creates a new session ID and assigns the given name.
   * Returns the new session ID.
   */
  async saveAs(state: PipelineState, name: string): Promise<string> {
    const { nanoid } = await import("nanoid");
    const newSessionId = nanoid();
    const namedState: PipelineState = {
      ...state,
      sessionId: newSessionId,
      sessionName: name,
      sessionDir: this.sessionDir(newSessionId),
    };
    await this.save(namedState);
    return newSessionId;
  }

  /**
   * Rename an existing session. Updates session.json and meta.json on disk.
   */
  async rename(sessionId: string, name: string): Promise<void> {
    const dir = this.sessionDir(sessionId);
    const sessionPath = join(dir, "session.json");
    const metaPath = join(dir, "meta.json");

    try {
      const sessionContent = await Bun.file(sessionPath).text();
      const sessionData = JSON.parse(sessionContent) as SessionFile;
      sessionData.name = name;
      await Bun.write(sessionPath, JSON.stringify(sessionData, null, 2));
    } catch {
      // Session file missing — skip
    }

    try {
      const metaContent = await Bun.file(metaPath).text();
      const metaData = JSON.parse(metaContent) as SessionMetadata;
      metaData.name = name;
      await Bun.write(metaPath, JSON.stringify(metaData, null, 2));
    } catch {
      // Meta file missing — skip
    }
  }

  /**
   * Load a session from disk by session ID.
   * Returns the SessionFile (pipeline is not yet hydrated into PipelineState).
   */
  async load(sessionId: string): Promise<SessionFile> {
    const dir = this.sessionDir(sessionId);
    const filePath = join(dir, "session.json");

    const content = await Bun.file(filePath).text();
    const raw = JSON.parse(content) as SessionFile;

    // Update last accessed time
    raw.lastAccessedAt = Date.now();
    await Bun.write(filePath, JSON.stringify(raw, null, 2));

    return raw;
  }

  /**
   * Hydrate a SessionFile into a PipelineState.
   * Cache records are NOT loaded — they are lazy-loaded via SessionCacheStore.
   */
  hydrate(session: SessionFile): PipelineState {
    const snapshot = deserializeSnapshot(session.pipeline);
    const cacheConfig = deserializeCacheConfig(session.cacheConfig);

    return {
      ...snapshot,
      focusedPanel: "pipeline",
      cache: new Map(),
      cacheConfig,
      inspector: {
        viewMode: "table",
        scrollOffset: 0,
        searchQuery: null,
        highlightedColumn: null,
      },
      executing: false,
      lastError: null,
      undoStack: session.undoStack.map(deserializeUndoEntry),
      redoStack: session.redoStack.map(deserializeUndoEntry),
      sessionId: session.sessionId,
      sessionDir: this.sessionDir(session.sessionId),
      sessionName: session.name,
    };
  }

  /**
   * List all saved sessions with their metadata, sorted by last accessed time.
   */
  async list(): Promise<SessionMetadata[]> {
    try {
      await mkdir(this.baseDir, { recursive: true });
      const entries = await readdir(this.baseDir, { withFileTypes: true });
      const sessions: SessionMetadata[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metaPath = join(this.baseDir, entry.name, "meta.json");
        try {
          const content = await Bun.file(metaPath).text();
          const meta = JSON.parse(content) as SessionMetadata;
          sessions.push(meta);
        } catch {
          // Skip sessions with missing/corrupt metadata
        }
      }

      // Sort by most recently accessed first
      sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
      return sessions;
    } catch {
      return [];
    }
  }

  /**
   * Find a session that was using a specific input file path.
   * Returns the most recently accessed matching session, or null.
   */
  async findByInputPath(filePath: string): Promise<SessionMetadata | null> {
    const resolved = basename(filePath);
    const sessions = await this.list();

    for (const session of sessions) {
      for (const inputPath of session.inputPaths) {
        if (inputPath === filePath || basename(inputPath) === resolved) {
          return session;
        }
      }
    }
    return null;
  }

  /**
   * Remove sessions older than 7 days (configurable via maxAgeMs).
   * Returns the number of sessions removed.
   */
  async clean(maxAgeMs: number = SESSION_MAX_AGE_MS): Promise<number> {
    const now = Date.now();
    let removed = 0;

    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const metaPath = join(this.baseDir, entry.name, "meta.json");
        try {
          const content = await Bun.file(metaPath).text();
          const meta = JSON.parse(content) as SessionMetadata;

          if (now - meta.lastAccessedAt > maxAgeMs) {
            await rm(join(this.baseDir, entry.name), {
              recursive: true,
              force: true,
            });
            removed++;
          }
        } catch {
          // If we can't read metadata, check file system timestamps
          const sessionDir = join(this.baseDir, entry.name);
          try {
            const stats = await stat(sessionDir);
            if (now - stats.mtimeMs > maxAgeMs) {
              await rm(sessionDir, { recursive: true, force: true });
              removed++;
            }
          } catch {
            // Can't stat either — skip
          }
        }
      }
    } catch {
      // Base directory doesn't exist — nothing to clean
    }

    return removed;
  }

  /**
   * Delete a specific session by ID.
   */
  async delete(sessionId: string): Promise<void> {
    const dir = this.sessionDir(sessionId);
    await rm(dir, { recursive: true, force: true });
  }

  /**
   * Check whether input files from a session still exist at their original paths.
   * Returns an array of missing file paths.
   */
  async verifyInputFiles(session: SessionFile): Promise<string[]> {
    const missing: string[] = [];
    const snapshot = deserializeSnapshot(session.pipeline);

    for (const input of snapshot.inputs.values()) {
      if (input.source.kind === "file") {
        try {
          await stat(input.source.path);
        } catch {
          missing.push(input.source.path);
        }
      }
    }

    return missing;
  }
}

// ── Serialization helpers ────────────────────────────────────────
// Maps/Sets cannot be serialized to JSON directly. We use a JSON
// replacer to convert them to arrays, and restore on deserialization.

/**
 * JSON.stringify replacer that converts Map → [key, value][] and Set → value[].
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) return Array.from(value.entries());
  if (value instanceof Set) return Array.from(value);
  return value;
}

function serializeSnapshot(snapshot: PipelineSnapshot): PipelineSnapshot {
  return snapshot;
}

function serializeUndoEntry(entry: UndoEntry): UndoEntry {
  return entry;
}

function serializeCacheConfig(config: CacheConfig): CacheConfig {
  return config;
}

function deserializeSnapshot(raw: PipelineSnapshot): PipelineSnapshot {
  return {
    stages: toMap(raw.stages),
    forks: toMap(raw.forks),
    inputs: toMap(raw.inputs),
    activeInputId: raw.activeInputId,
    activeForkId: raw.activeForkId,
    cursorStageId: raw.cursorStageId,
  };
}

function deserializeUndoEntry(raw: UndoEntry): UndoEntry {
  return {
    label: raw.label,
    snapshot: deserializeSnapshot(raw.snapshot),
    timestamp: raw.timestamp,
  };
}

function deserializeCacheConfig(raw: CacheConfig): CacheConfig {
  return {
    maxMemoryBytes: raw.maxMemoryBytes,
    cachePolicy: raw.cachePolicy,
    pinnedStageIds: toSet(raw.pinnedStageIds),
  };
}

/**
 * Convert a value that may be a Map, an array of [key, value] pairs,
 * or a plain object into a Map.
 */
function toMap<K extends string, V>(value: unknown): Map<K, V> {
  if (value instanceof Map) return value;
  if (Array.isArray(value)) return new Map(value as Array<[K, V]>);
  // Plain object from JSON
  if (value !== null && typeof value === "object") {
    return new Map(Object.entries(value) as Array<[K, V]>);
  }
  return new Map();
}

/**
 * Convert a value that may be a Set or an array into a Set.
 */
function toSet<T>(value: unknown): Set<T> {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value as T[]);
  return new Set();
}

// ── Metadata builder ─────────────────────────────────────────────

function buildMetadata(
  state: PipelineState,
  cacheManifest: Array<{ sizeBytes: number }>,
): SessionMetadata {
  const inputPaths: string[] = [];
  for (const input of state.inputs.values()) {
    if (input.source.kind === "file") {
      inputPaths.push(input.source.path);
    }
  }

  const fork = state.forks.get(state.activeForkId);
  const stageCount = fork?.stageIds.length ?? 0;

  const stageNames: string[] = [];
  if (fork) {
    for (const stageId of fork.stageIds.slice(0, 5)) {
      const stage = state.stages.get(stageId);
      if (stage) stageNames.push(stage.config.operationName);
    }
  }

  const summary =
    stageCount === 0
      ? "empty pipeline"
      : `${stageNames.join(" | ")}${stageCount > 5 ? ` (+${stageCount - 5} more)` : ""}`;

  const cacheSizeBytes = cacheManifest.reduce(
    (sum, entry) => sum + entry.sizeBytes,
    0,
  );

  return {
    sessionId: state.sessionId,
    name: state.sessionName,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    inputPaths,
    stageCount,
    cacheSizeBytes,
    pipelineSummary: summary,
  };
}
