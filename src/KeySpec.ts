import type { JsonValue, JsonObject, JsonArray } from "./types/json.ts";

/**
 * KeySpec parses and resolves key specification strings for navigating
 * nested data structures within Records.
 *
 * Key spec syntax:
 * - "foo/bar" nested hash access
 * - "#0" array index access
 * - "@fuzzy" prefix with @ for fuzzy matching
 * - "foo\\/bar" escape / for literal slash in key name
 *
 * Analogous to App::RecordStream::KeySpec in Perl.
 */

// Fast path: detect simple keys that need no parsing (no /, #, @, \)
function isSimpleKey(spec: string): boolean {
  if (spec.length === 0 || spec.charCodeAt(0) === 64 /* @ */) return false;
  for (let i = 0; i < spec.length; i++) {
    const ch = spec.charCodeAt(i);
    if (ch === 47 /* / */ || ch === 92 /* \ */ || ch === 35 /* # */) return false;
  }
  return true;
}

// Cache for parsed KeySpec objects
const specRegistry = new Map<string, KeySpec>();

// Cache for fuzzy key resolution: "keyChain" -> searchString -> resolvedKey
const fuzzyKeyCache = new Map<string, Map<string, string>>();

export class KeySpec {
  readonly spec: string;
  readonly parsedKeys: string[];
  readonly fuzzy: boolean;

  constructor(spec: string) {
    // Check cache first
    const cached = specRegistry.get(spec);
    if (cached) {
      this.spec = cached.spec;
      this.parsedKeys = cached.parsedKeys;
      this.fuzzy = cached.fuzzy;
      return;
    }

    this.spec = spec;
    if (isSimpleKey(spec)) {
      this.parsedKeys = [spec];
      this.fuzzy = false;
    } else {
      const { keys, fuzzy } = parseKeySpec(spec);
      this.parsedKeys = keys;
      this.fuzzy = fuzzy;
    }

    specRegistry.set(spec, this);
  }

  /**
   * Resolve the value of this key spec in the given data.
   * Returns { value, found } where found indicates whether the key exists.
   *
   * @param noVivify - If true, don't create intermediate structures
   * @param throwError - If true, throw on missing key
   */
  resolve(
    data: JsonObject,
    noVivify = false,
    throwError = false
  ): { value: JsonValue | undefined; found: boolean } {
    // Fast path: single non-fuzzy key
    if (this.parsedKeys.length === 1 && !this.fuzzy) {
      const key = this.parsedKeys[0]!;
      const exists = key in data;
      if (!exists && throwError) throw new NoSuchKeyError();
      if (!exists && noVivify) return { value: undefined, found: false };
      return { value: data[key], found: true };
    }

    return guessKeyRecurse(
      data,
      [],
      this.parsedKeys,
      0,
      noVivify,
      throwError,
      this.fuzzy,
      false
    ) as { value: JsonValue | undefined; found: boolean };
  }

  /**
   * Set a value at this key spec location, creating intermediate structures.
   */
  setValue(data: JsonObject, value: JsonValue): void {
    // Fast path: single non-fuzzy key
    if (this.parsedKeys.length === 1 && !this.fuzzy) {
      data[this.parsedKeys[0]!] = value;
      return;
    }
    setNestedValue(data, this.parsedKeys, value, this.fuzzy);
  }

  /**
   * Check if this key spec exists in the data.
   */
  hasKeySpec(data: JsonObject): boolean {
    try {
      this.resolve(data, true, true);
      return true;
    } catch (e) {
      if (e instanceof NoSuchKeyError) return false;
      throw e;
    }
  }

  /**
   * Get the list of actual keys traversed for this spec.
   */
  getKeyListForSpec(data: JsonObject): string[] {
    return guessKeyRecurse(
      data,
      [],
      this.parsedKeys,
      0,
      true,
      false,
      this.fuzzy,
      true
    ) as string[];
  }
}

export class NoSuchKeyError extends Error {
  constructor(message = "NoSuchKey") {
    super(message);
    this.name = "NoSuchKeyError";
  }
}

/**
 * Convenience function: resolve a key spec on data.
 */
export function findKey(
  data: JsonObject,
  spec: string,
  noVivify = false,
  throwError = false
): JsonValue | undefined {
  // Fast path: simple keys bypass KeySpec entirely
  if (isSimpleKey(spec)) {
    if (throwError && !(spec in data)) throw new NoSuchKeyError();
    return data[spec];
  }
  const ks = new KeySpec(spec);
  const result = ks.resolve(data, noVivify, throwError);
  return result.value;
}

/**
 * Convenience function: set a value at a key spec location.
 */
export function setKey(
  data: JsonObject,
  spec: string,
  value: JsonValue
): void {
  // Fast path: simple keys bypass KeySpec entirely
  if (isSimpleKey(spec)) {
    data[spec] = value;
    return;
  }
  const ks = new KeySpec(spec);
  ks.setValue(data, value);
}

/**
 * Parse a key spec string into component keys.
 * Handles @ prefix for fuzzy matching and \/ for escaped slashes.
 */
function parseKeySpec(spec: string): { keys: string[]; fuzzy: boolean } {
  let fuzzy = false;
  let rawSpec = spec;

  if (rawSpec.startsWith("@")) {
    fuzzy = true;
    rawSpec = rawSpec.slice(1);
  }

  const keys: string[] = [];
  let currentKey = "";
  let lastChar = "";

  for (let i = 0; i < rawSpec.length; i++) {
    const ch = rawSpec[i]!;

    if (ch === "/" && lastChar !== "\\") {
      keys.push(currentKey);
      currentKey = "";
      lastChar = "";
      continue;
    } else {
      if (ch === "/") {
        // This is an escaped slash - remove the backslash
        currentKey = currentKey.slice(0, -1);
      }
      currentKey += ch;
      lastChar = ch;
    }
  }

  if (currentKey !== "") {
    keys.push(currentKey);
  }

  return { keys, fuzzy };
}

/**
 * Guess the actual key name from a search string, handling fuzzy matching
 * and array index notation.
 */
function guessKeyNameRaw(
  data: JsonValue,
  keyChain: string[],
  searchString: string,
  fuzzy: boolean
): string {
  // Array index access
  if (Array.isArray(data)) {
    const match = searchString.match(/^#(\d+)$/);
    if (match) return match[1]!;
    throw new Error(
      `Cannot select non-numeric index: ${searchString} (did you forget to prefix with a '#'?) for array`
    );
  }

  // Not fuzzy? Return exact key
  if (!fuzzy) return searchString;

  // Check fuzzy cache
  const chainKey = keyChain.join("-");
  let chainCache = fuzzyKeyCache.get(chainKey);
  if (chainCache) {
    const cached = chainCache.get(searchString);
    if (cached !== undefined) return cached;
  }

  const obj = data as JsonObject;
  let foundKey: string | undefined;

  // 1. Exact match
  if (obj[searchString] !== undefined) {
    foundKey = searchString;
  } else {
    // 2. Prefix match (case insensitive)
    const sortedKeys = Object.keys(obj).sort();
    const lowerSearch = searchString.toLowerCase();
    for (const key of sortedKeys) {
      if (key.toLowerCase().startsWith(lowerSearch)) {
        foundKey = key;
      }
    }

    // 3. Match anywhere in key (regex, case insensitive)
    if (!foundKey) {
      try {
        const regex = new RegExp(searchString, "i");
        for (const key of sortedKeys) {
          if (regex.test(key)) {
            foundKey = key;
          }
        }
      } catch {
        // Invalid regex, fall through
      }
    }
  }

  if (!foundKey) {
    foundKey = searchString;
  }

  // Cache the result
  if (!chainCache) {
    chainCache = new Map();
    fuzzyKeyCache.set(chainKey, chainCache);
  }
  chainCache.set(searchString, foundKey);

  return foundKey;
}

/**
 * Recursively resolve a key spec through nested data.
 */
function guessKeyRecurse(
  data: JsonValue | undefined,
  keyChain: string[],
  parsedKeys: string[],
  keyIndex: number,
  noVivify: boolean,
  throwError: boolean,
  fuzzy: boolean,
  returnKeyChain: boolean
): { value: JsonValue | undefined; found: boolean } | string[] {
  if (keyIndex >= parsedKeys.length) {
    // Shouldn't happen in normal usage
    if (returnKeyChain) return keyChain;
    return { value: data, found: true };
  }

  const searchString = parsedKeys[keyIndex]!;

  if (data === null || data === undefined) {
    if (throwError) throw new NoSuchKeyError();
    if (noVivify) {
      return returnKeyChain ? [] : { value: undefined, found: false };
    }
  }

  if (typeof data !== "object" && data !== null && data !== undefined) {
    throw new Error(`Cannot look for ${searchString} in scalar: ${JSON.stringify(data)}`);
  }

  const key = guessKeyNameRaw(data!, keyChain, searchString, fuzzy);
  let value: JsonValue | undefined;
  let resolvedKey: string;

  if (Array.isArray(data)) {
    const index = parseInt(key, 10);
    value = data[index];
    resolvedKey = `#${key}`;
  } else {
    const obj = data as JsonObject;
    if (!(key in obj)) {
      if (throwError) throw new NoSuchKeyError();
      if (noVivify) {
        return returnKeyChain ? [] : { value: undefined, found: false };
      }
    }
    value = obj[key];
    resolvedKey = key;
  }

  const isLastKey = keyIndex === parsedKeys.length - 1;

  if (!isLastKey) {
    // More keys to traverse
    if (value === null || value === undefined) {
      if (throwError) throw new NoSuchKeyError();
      if (noVivify) {
        return returnKeyChain ? [] : { value: undefined, found: false };
      }
      // Vivify: create intermediate structure
      const nextKey = parsedKeys[keyIndex + 1]!;
      if (nextKey.startsWith("#")) {
        value = [];
      } else {
        value = {};
      }
      // Write back into data
      if (Array.isArray(data)) {
        const idx = parseInt(key, 10);
        (data as JsonArray)[idx] = value;
      } else {
        (data as JsonObject)[key] = value;
      }
    }

    return guessKeyRecurse(
      value,
      [...keyChain, resolvedKey],
      parsedKeys,
      keyIndex + 1,
      noVivify,
      throwError,
      fuzzy,
      returnKeyChain
    );
  }

  if (returnKeyChain) return [...keyChain, resolvedKey];
  return { value, found: true };
}

/**
 * Set a value at a nested key spec location, creating intermediates.
 */
function setNestedValue(
  data: JsonObject,
  parsedKeys: string[],
  value: JsonValue,
  fuzzy: boolean
): void {
  let current: JsonValue = data;

  for (let i = 0; i < parsedKeys.length - 1; i++) {
    const searchString = parsedKeys[i]!;
    const key = guessKeyNameRaw(current, [], searchString, fuzzy);

    let next: JsonValue | undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(key, 10);
      next = current[idx];
    } else {
      next = (current as JsonObject)[key];
    }

    if (next === null || next === undefined) {
      // Create intermediate
      const nextKey = parsedKeys[i + 1]!;
      next = nextKey.startsWith("#") ? [] : {};
      if (Array.isArray(current)) {
        const idx = parseInt(key, 10);
        current[idx] = next;
      } else {
        (current as JsonObject)[key] = next;
      }
    }
    current = next;
  }

  // Set the final value
  const lastKey = parsedKeys[parsedKeys.length - 1]!;
  const finalKey = guessKeyNameRaw(current, [], lastKey, fuzzy);

  if (Array.isArray(current)) {
    const idx = parseInt(finalKey, 10);
    current[idx] = value;
  } else {
    (current as JsonObject)[finalKey] = value;
  }
}

/**
 * Clear all caches (useful for testing).
 */
export function clearKeySpecCaches(): void {
  specRegistry.clear();
  fuzzyKeyCache.clear();
}
