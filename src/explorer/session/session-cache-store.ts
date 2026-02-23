/**
 * JSONL file-based cache storage for session persistence.
 *
 * Writes CachedResult records to .jsonl files in the session's cache/ directory.
 * Supports lazy loading: cache manifest (metadata) is loaded on resume,
 * but actual record data is only read from disk when a stage is inspected.
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type {
  CachedResult,
  CacheManifestEntry,
  InputId,
  StageId,
} from "../model/types.ts";
import { Record } from "../../Record.ts";

/**
 * Manages reading and writing cached records as JSONL files in a session directory.
 */
export class SessionCacheStore {
  readonly cacheDir: string;

  constructor(sessionDir: string) {
    this.cacheDir = join(sessionDir, "cache");
  }

  /**
   * Ensure the cache directory exists.
   */
  async init(): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
  }

  /**
   * Write a CachedResult's records to a JSONL file.
   * Returns a CacheManifestEntry describing the written file.
   */
  async writeCache(result: CachedResult): Promise<CacheManifestEntry> {
    await this.init();

    const fileName = `${result.inputId}-${result.stageId}.jsonl`;
    const filePath = join(this.cacheDir, fileName);

    const lines = result.records.map((r) => JSON.stringify(r.toJSON()));
    const content = lines.join("\n") + (lines.length > 0 ? "\n" : "");

    await Bun.write(filePath, content);

    return {
      key: result.key,
      cacheKey: result.key,
      recordCount: result.recordCount,
      fieldNames: [...result.fieldNames],
      sizeBytes: result.sizeBytes,
      computedAt: result.computedAt,
      computeTimeMs: result.computeTimeMs,
      file: `cache/${fileName}`,
    };
  }

  /**
   * Read cached records from a JSONL file (lazy loading).
   * Returns a full CachedResult with records populated.
   */
  async readCache(
    manifest: CacheManifestEntry,
    sessionDir: string,
  ): Promise<CachedResult> {
    const filePath = join(sessionDir, manifest.file);
    const content = await Bun.file(filePath).text();
    const records = parseJsonlRecords(content);

    // Parse inputId and stageId from the key
    const [inputId, stageId] = parseKey(manifest.key);

    return {
      key: manifest.key,
      stageId,
      inputId,
      records,
      spillFile: null,
      recordCount: manifest.recordCount,
      fieldNames: [...manifest.fieldNames],
      computedAt: manifest.computedAt,
      sizeBytes: manifest.sizeBytes,
      computeTimeMs: manifest.computeTimeMs,
    };
  }

  /**
   * Write all cached results from state to disk.
   * Returns the cache manifest for session.json.
   */
  async writeAllCaches(
    cache: Map<string, CachedResult>,
  ): Promise<CacheManifestEntry[]> {
    const entries: CacheManifestEntry[] = [];
    for (const result of cache.values()) {
      const entry = await this.writeCache(result);
      entries.push(entry);
    }
    return entries;
  }

  /**
   * Remove a specific cache file.
   */
  async removeCache(inputId: InputId, stageId: StageId): Promise<void> {
    const fileName = `${inputId}-${stageId}.jsonl`;
    const filePath = join(this.cacheDir, fileName);
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(filePath);
    } catch {
      // File may not exist — that's fine
    }
  }

  /**
   * Remove the entire cache directory.
   */
  async clearAll(): Promise<void> {
    try {
      const { rm } = await import("node:fs/promises");
      await rm(this.cacheDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  }
}

/**
 * Parse JSONL content into Record objects.
 */
function parseJsonlRecords(content: string): Record[] {
  const records: Record[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      records.push(Record.fromJSON(trimmed));
    } catch {
      // Skip malformed lines
    }
  }
  return records;
}

/**
 * Parse a cache key string ("inputId:stageId") into its components.
 */
function parseKey(key: string): [InputId, StageId] {
  const colonIdx = key.indexOf(":");
  if (colonIdx === -1) return [key, key];
  return [key.slice(0, colonIdx), key.slice(colonIdx + 1)];
}
