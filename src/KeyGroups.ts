import type { JsonValue, JsonObject } from "./types/json.ts";
import { KeySpec } from "./KeySpec.ts";

/**
 * KeyGroups parses and resolves multi-key group specifications.
 * Groups can be:
 * - Plain key specs (e.g., "foo/bar", "@fuzzy")
 * - Regex groups (e.g., "!regex!", "!regex!f", "!regex!d=2!rr")
 *
 * Multiple groups can be comma-separated: "!foo!,!bar!f"
 *
 * Analogous to App::RecordStream::KeyGroups in Perl.
 */

interface GroupMember {
  getFields(record: JsonObject): string[];
}

// Valid group options and their normalized names
const VALID_OPTIONS: Record<string, string> = {
  d: "depth",
  depth: "depth",
  s: "sort",
  sort: "sort",
  f: "full_match",
  full: "full_match",
  rr: "return_refs",
  returnrefs: "return_refs",
};

export class KeyGroups {
  #groups: GroupMember[] = [];
  #cachedSpecs: string[] | null = null;

  constructor(...args: string[]) {
    for (const arg of args) {
      this.addGroups(arg);
    }
  }

  hasAnyGroup(): boolean {
    return this.#groups.length > 0;
  }

  addGroups(groups: string): void {
    for (const groupSpec of groups.split(",")) {
      if (groupSpec.startsWith("!")) {
        this.#groups.push(new KeyGroupRegex(groupSpec));
      } else {
        this.#groups.push(new KeyGroupKeySpec(groupSpec));
      }
    }
    // Invalidate cache when groups change
    this.#cachedSpecs = null;
  }

  /**
   * Get keyspecs for a record (always recomputes).
   */
  getKeyspecsForRecord(record: JsonObject): string[] {
    const specs: string[] = [];
    for (const group of this.#groups) {
      specs.push(...group.getFields(record));
    }
    return specs;
  }

  /**
   * Get keyspecs, caching after first call.
   */
  getKeyspecs(record: JsonObject): string[] {
    if (this.#cachedSpecs === null) {
      this.#cachedSpecs = this.getKeyspecsForRecord(record);
    }
    return this.#cachedSpecs;
  }
}

/**
 * A plain key spec group member - resolves a single key spec.
 */
class KeyGroupKeySpec implements GroupMember {
  #keySpec: KeySpec;

  constructor(spec: string) {
    this.#keySpec = new KeySpec(spec);
  }

  getFields(record: JsonObject): string[] {
    if (this.#keySpec.hasKeySpec(record)) {
      const keyList = this.#keySpec.getKeyListForSpec(record);
      if (keyList.length > 0) {
        return [keyList.join("/")];
      }
    }
    return [];
  }
}

/**
 * A regex-based group member - matches keys by pattern with options.
 * Syntax: !regex!opt1!opt2...
 */
class KeyGroupRegex implements GroupMember {
  regex: string = "";
  options: Record<string, string | undefined> = {};

  constructor(spec: string) {
    this.parseGroup(spec);
  }

  parseGroup(spec: string): void {
    if (spec[0] !== "!") {
      throw new Error(`Malformed group spec: '${spec}', does not start with '!'`);
    }

    if (spec.length < 2) {
      throw new Error(`Malformed group spec: '${spec}', does not have enough length`);
    }

    let regex = "";
    let lastChar = "";
    let foundEnd = false;
    let startOptionIndex = 1;

    for (let index = 1; index < spec.length; index++) {
      startOptionIndex++;
      const currentChar = spec[index]!;

      if (currentChar === "!" && lastChar !== "\\") {
        foundEnd = true;
        break;
      }
      lastChar = currentChar;
      regex += currentChar;
    }

    if (!foundEnd) {
      throw new Error(`Malformed group spec: Did not find terminating '!' in '${spec}'`);
    }

    const optionsString = spec.slice(startOptionIndex);
    const options: Record<string, string | undefined> = {};

    if (optionsString.length > 0) {
      for (const optionGroup of optionsString.split("!")) {
        if (optionGroup === "") continue;
        const eqIndex = optionGroup.indexOf("=");
        let optionName: string;
        let optionValue: string | undefined;

        if (eqIndex >= 0) {
          optionName = optionGroup.slice(0, eqIndex);
          optionValue = optionGroup.slice(eqIndex + 1);
        } else {
          optionName = optionGroup;
          optionValue = undefined;
        }

        const normalizedOption = VALID_OPTIONS[optionName];
        if (!normalizedOption) {
          throw new Error(
            `Malformed group spec: Unrecognized option: '${optionName}' in '${spec}'`
          );
        }
        if (normalizedOption in options) {
          throw new Error(
            `Already specified option '${optionName}'. Bad option: '${optionGroup}' in '${spec}'`
          );
        }
        options[normalizedOption] = optionValue;
      }
    }

    this.regex = regex;
    this.options = options;
  }

  hasOption(name: string): boolean {
    return name in this.options;
  }

  optionValue(name: string): string | undefined {
    return this.options[name];
  }

  getFields(record: JsonObject): string[] {
    const specs: string[] = [];
    const regex = new RegExp(this.regex);
    const allSpecs = this.#getSpecs(record);

    for (const spec of allSpecs) {
      if (regex.test(spec)) {
        specs.push(spec);
      }
    }

    if (this.hasOption("sort")) {
      specs.sort();
    }

    return specs;
  }

  #getSpecs(record: JsonObject): string[] {
    let minDepth = 1;
    let maxDepth = 1;

    if (this.hasOption("full_match")) {
      maxDepth = -1; // unlimited
    } else if (this.hasOption("depth")) {
      const depth = parseInt(this.optionValue("depth") ?? "1", 10);
      minDepth = depth;
      maxDepth = depth;
    }

    const paths: string[][] = [];
    this.#getPaths(record, 1, minDepth, maxDepth, [], paths);
    return paths.map((p) => p.join("/"));
  }

  #getPaths(
    data: JsonValue,
    currentDepth: number,
    minDepth: number,
    maxDepth: number,
    currentKeys: string[],
    foundPaths: string[][]
  ): void {
    // At or beyond min depth, check if we should include this path
    if (currentDepth >= minDepth) {
      const isScalar =
        typeof data !== "object" || data === null;
      if (isScalar || this.hasOption("return_refs")) {
        // Only add if we have keys (i.e., not the root)
        if (currentKeys.length > 0) {
          foundPaths.push([...currentKeys]);
        }
      }
    }

    // Recurse into arrays
    if (Array.isArray(data)) {
      for (let index = 0; index < data.length; index++) {
        if (currentDepth <= maxDepth || maxDepth === -1) {
          this.#getPaths(
            data[index]!,
            currentDepth + 1,
            minDepth,
            maxDepth,
            [...currentKeys, `#${index}`],
            foundPaths
          );
        }
      }
    }

    // Recurse into objects
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      for (const key of Object.keys(data as JsonObject)) {
        if (currentDepth <= maxDepth || maxDepth === -1) {
          this.#getPaths(
            (data as JsonObject)[key]!,
            currentDepth + 1,
            minDepth,
            maxDepth,
            [...currentKeys, key],
            foundPaths
          );
        }
      }
    }
  }
}
