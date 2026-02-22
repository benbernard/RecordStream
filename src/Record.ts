import type { JsonValue, JsonObject } from "./types/json.ts";

/**
 * A Record wraps a plain JSON object and provides methods for
 * nested key access. This is the fundamental data unit flowing
 * through RecordStream pipelines.
 *
 * Analogous to App::RecordStream::Record in Perl.
 */
export class Record {
  #data: JsonObject;

  constructor(data?: JsonObject) {
    this.#data = data ?? {};
  }

  /**
   * Get a top-level field value. For nested access, use getKeySpec().
   */
  get(key: string): JsonValue | undefined {
    return this.#data[key];
  }

  /**
   * Set a top-level field value. Returns the old value.
   */
  set(key: string, value: JsonValue): JsonValue | undefined {
    const old = this.#data[key];
    this.#data[key] = value;
    return old;
  }

  /**
   * Remove one or more top-level fields. Returns array of old values.
   */
  remove(...keys: string[]): (JsonValue | undefined)[] {
    return keys.map((key) => {
      const old = this.#data[key];
      delete this.#data[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
      return old;
    });
  }

  /**
   * Check if a top-level field exists.
   */
  has(key: string): boolean {
    return key in this.#data;
  }

  /**
   * Rename a field. If the old field did not exist, creates the new field with null.
   */
  rename(oldKey: string, newKey: string): void {
    const value = this.has(oldKey) ? this.#data[oldKey] : null;
    this.set(newKey, value!);
    this.remove(oldKey);
  }

  /**
   * Prune record to only the specified keys.
   */
  pruneTo(...keys: string[]): void {
    const keep = new Set(keys);
    for (const key of this.keys()) {
      if (!keep.has(key)) {
        delete this.#data[key]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
      }
    }
  }

  /**
   * Return all top-level field names.
   */
  keys(): string[] {
    return Object.keys(this.#data);
  }

  /**
   * Return a deep clone of this record.
   */
  clone(): Record {
    return new Record(structuredClone(this.#data));
  }

  /**
   * Return the underlying data as a plain JSON object (shallow copy).
   */
  toJSON(): JsonObject {
    return { ...this.#data };
  }

  /**
   * Return the record as a reference to the underlying data (no copy).
   * Mutations to the returned object will affect the record.
   */
  dataRef(): JsonObject {
    return this.#data;
  }

  /**
   * Serialize to a JSON line (no trailing newline).
   */
  toString(): string {
    return JSON.stringify(this.#data);
  }

  /**
   * Parse a JSON line into a Record.
   */
  static fromJSON(line: string): Record {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`Record.fromJSON expects a JSON object, got: ${typeof parsed}`);
    }
    return new Record(parsed as JsonObject);
  }

  /**
   * Compare this record to another using sort specs.
   * Specs are like "field" for lexical ascending, or "field=-numeric" for descending numeric.
   */
  cmp(that: Record, ...specs: string[]): number {
    const comparators = Record.getComparators(specs);
    for (const comparator of comparators) {
      const val = comparator(this, that);
      if (val !== 0) return val;
    }
    return 0;
  }

  /**
   * Sort an array of records by the given specs.
   * Returns a new sorted array (stable sort).
   */
  static sort(records: Record[], ...specs: string[]): Record[] {
    const comparators = Record.getComparators(specs);
    // Create indexed array for stable sort
    const indexed = records.map((r, i) => ({ record: r, index: i }));
    indexed.sort((a, b) => {
      for (const comparator of comparators) {
        const val = comparator(a.record, b.record);
        if (val !== 0) return val;
      }
      return a.index - b.index; // stable sort fallback
    });
    return indexed.map((x) => x.record);
  }

  /**
   * Build comparator functions from sort spec strings.
   */
  static getComparators(
    specs: string[]
  ): ((a: Record, b: Record) => number)[] {
    return specs.map((spec) => Record.getComparator(spec));
  }

  /**
   * Build a single comparator from a sort spec.
   * Spec format: "field" for lexical ascending, or "field=[-+][type][*]"
   * Types: "", "l", "lex", "lexical" for string compare;
   *        "n", "nat", "natural", "num", "numeric" for numeric compare.
   * Trailing "*" sorts "ALL" values to the end.
   */
  static getComparator(spec: string): (a: Record, b: Record) => number {
    const { comparator } = Record.getComparatorAndField(spec);
    return comparator;
  }

  static getComparatorAndField(spec: string): {
    comparator: (a: Record, b: Record) => number;
    field: string;
  } {
    let field: string;
    let direction: string;
    let comparatorName: string;
    let allHack: boolean;

    if (spec.includes("=")) {
      const match = spec.match(/^(.*)=([-+]?)(.*?)(\*?)$/);
      if (!match) throw new Error(`Invalid sort spec: ${spec}`);
      field = match[1]!;
      direction = match[2] || "+";
      comparatorName = match[3]!;
      allHack = match[4] === "*";
    } else {
      field = spec;
      direction = "+";
      comparatorName = "lexical";
      allHack = false;
    }

    const cmpFn = COMPARATOR_TYPES[comparatorName];
    if (!cmpFn) {
      throw new Error(`Not a valid comparator: ${comparatorName}`);
    }

    const comparator = (a: Record, b: Record): number => {
      // Basic dot-path access for now (will be replaced by KeySpec later)
      const aVal = getNestedValue(a.#data, field);
      const bVal = getNestedValue(b.#data, field);

      let val: number | undefined;

      if (allHack) {
        if (aVal === "ALL" && bVal !== "ALL") val = 1;
        if (aVal !== "ALL" && bVal === "ALL") val = -1;
        if (aVal === "ALL" && bVal === "ALL") return 0;
      }

      if (val === undefined) {
        val = cmpFn(aVal, bVal);
      }

      return direction === "-" ? -val : val;
    };

    return { comparator, field };
  }
}

// --- Comparator implementations ---

function cmpLex(a: JsonValue | undefined, b: JsonValue | undefined): number {
  const sa = String(a ?? "");
  const sb = String(b ?? "");
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

function cmpNumeric(
  a: JsonValue | undefined,
  b: JsonValue | undefined
): number {
  const na = Number(a);
  const nb = Number(b);
  if (isNaN(na) && isNaN(nb)) return 0;
  if (isNaN(na)) return -1;
  if (isNaN(nb)) return 1;
  return na - nb;
}

const COMPARATOR_TYPES: {
  [name: string]: (a: JsonValue | undefined, b: JsonValue | undefined) => number;
} = {
  "": cmpLex,
  l: cmpLex,
  lex: cmpLex,
  lexical: cmpLex,
  n: cmpNumeric,
  nat: cmpNumeric,
  natural: cmpNumeric,
  num: cmpNumeric,
  numeric: cmpNumeric,
};

/**
 * Basic dot-path nested value access (temporary until KeySpec is implemented).
 * Supports "foo/bar" for nested hash and "#N" for array indices.
 */
function getNestedValue(
  data: JsonValue | undefined,
  keySpec: string
): JsonValue | undefined {
  const parts = keySpec.split("/");
  let current: JsonValue | undefined = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (part.startsWith("#")) {
      // Array index access
      const index = parseInt(part.slice(1), 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as JsonObject)[part];
    } else {
      return undefined;
    }
  }

  return current;
}
