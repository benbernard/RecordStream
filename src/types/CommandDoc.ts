/**
 * Documentation metadata for a recs command / operation.
 *
 * Every operation should export a `documentation: CommandDoc` so the
 * doc-checker CI step can verify completeness.
 */

export interface OptionDoc {
  flags: string[];
  description: string;
  argument?: string;
  required?: boolean;
}

export interface ExampleDoc {
  description: string;
  command: string;
  input?: string;
  output?: string;
}

export interface CommandDoc {
  name: string;
  category: "input" | "transform" | "output";
  synopsis: string;
  description: string;
  options: OptionDoc[];
  examples: ExampleDoc[];
  seeAlso?: string[];
}
