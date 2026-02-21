/**
 * Generic plugin registry for discovering and creating implementations
 * by name. Used as the base for Aggregator, Clumper, and Deaggregator
 * registries.
 *
 * Analogous to App::RecordStream::BaseRegistry in Perl.
 */

export interface RegistryEntry<T> {
  /** The implementation class/factory */
  create: (...args: string[]) => T;
  /** Valid argument counts */
  argCounts: number[];
  /** Short one-line description */
  shortUsage: string;
  /** Full usage text */
  longUsage: string;
  /** Alternative names for this implementation */
  aliases?: string[];
}

export class BaseRegistry<T> {
  #implementations = new Map<string, RegistryEntry<T>>();
  readonly typeName: string;

  constructor(typeName: string) {
    this.typeName = typeName;
  }

  /**
   * Register an implementation under a name.
   */
  register(name: string, entry: RegistryEntry<T>): void {
    this.#implementations.set(name, entry);
    if (entry.aliases) {
      for (const alias of entry.aliases) {
        this.#implementations.set(alias, entry);
      }
    }
  }

  /**
   * Parse a spec string (name,arg1,arg2,...) and create an instance.
   */
  parse(spec: string): T {
    const parts = spec.split(",");
    if (parts.length === 0 || parts[0] === "") {
      throw new Error(`Bad ${this.typeName} spec: ${spec}`);
    }

    const name = parts[0]!;
    const args = parts.slice(1);

    const entry = this.#implementations.get(name);
    if (!entry) {
      throw new Error(`Bad ${this.typeName}: ${name}`);
    }

    if (!entry.argCounts.includes(args.length)) {
      throw new Error(
        `Wrong number of arguments for ${this.typeName} ${name}: ` +
          `expected ${entry.argCounts.join(" or ")}, got ${args.length}\n` +
          entry.longUsage
      );
    }

    return entry.create(...args);
  }

  /**
   * Check if a name is registered.
   */
  has(name: string): boolean {
    return this.#implementations.has(name);
  }

  /**
   * Get an entry by name.
   */
  get(name: string): RegistryEntry<T> | undefined {
    return this.#implementations.get(name);
  }

  /**
   * List all implementations with their short usage.
   */
  listImplementations(prefix = ""): string {
    // Group by entry to handle aliases
    const entryToNames = new Map<RegistryEntry<T>, string[]>();
    const entries: RegistryEntry<T>[] = [];

    const sortedNames = [...this.#implementations.keys()].sort();
    for (const name of sortedNames) {
      const entry = this.#implementations.get(name)!;
      let names = entryToNames.get(entry);
      if (!names) {
        names = [];
        entryToNames.set(entry, names);
        entries.push(entry);
      }
      names.push(name);
    }

    let result = "";
    for (const entry of entries) {
      const names = entryToNames.get(entry)!;
      result += `${prefix}${names.join(", ")}: ${entry.shortUsage}\n`;
    }
    return result;
  }

  /**
   * Get the detailed usage for a specific implementation.
   */
  showImplementation(name: string): string {
    const entry = this.#implementations.get(name);
    if (!entry) {
      return `Bad ${this.typeName}: ${name}\n`;
    }
    return entry.longUsage;
  }

  /**
   * Get all registered names.
   */
  names(): string[] {
    return [...this.#implementations.keys()];
  }
}
