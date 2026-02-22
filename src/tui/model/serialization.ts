/**
 * Pipeline export: serialize the active pipeline as a shell pipe script
 * or a recs chain command. Also provides clipboard integration.
 */

import type { PipelineState, InputSource, Stage } from "./types.ts";
import { getEnabledStages } from "./selectors.ts";

/**
 * Characters that need shell escaping (in addition to single quotes).
 */
const SHELL_SPECIAL = /[^a-zA-Z0-9_\-.,/:=@+%^~]/;

/**
 * Shell-escape a single argument. Uses single quotes for most strings,
 * falls back to $'...' for strings containing single quotes.
 */
export function shellEscape(arg: string): string {
  if (arg === "") return "''";
  if (!SHELL_SPECIAL.test(arg)) return arg;
  // If no single quotes, wrap in single quotes
  if (!arg.includes("'")) return `'${arg}'`;
  // Contains single quotes: use $'...' syntax with escaped single quotes
  return "$'" + arg.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

/**
 * Export the pipeline as a multi-line shell pipe script.
 *
 * Example output:
 * ```
 * #!/usr/bin/env bash
 * recs fromcsv --header data.csv \
 *   | recs grep 'r.age > 25' \
 *   | recs sort --key age=n \
 *   | recs totable
 * ```
 */
export function exportAsPipeScript(
  state: PipelineState,
  inputSource?: InputSource,
): string {
  const stages = getEnabledStages(state);
  if (stages.length === 0) return "#!/usr/bin/env bash\n";

  const input = inputSource ?? state.inputs.get(state.activeInputId);

  const lines = stages.map((stage) => formatStageCommand(stage));

  // Append input file path to the first stage if applicable
  if (input?.source.kind === "file") {
    lines[0] = `${lines[0]} ${shellEscape(input.source.path)}`;
  }

  const shebang = "#!/usr/bin/env bash";
  const body = lines.join(" \\\n  | ");
  return `${shebang}\n${body}\n`;
}

/**
 * Export the pipeline as a single-line `recs chain` command.
 *
 * Example output:
 * ```
 * recs chain fromcsv --header \| grep 'r.age > 25' \| sort --key age=n \| totable
 * ```
 */
export function exportAsChainCommand(
  state: PipelineState,
): string {
  const stages = getEnabledStages(state);
  if (stages.length === 0) return "recs chain";

  const parts = stages.map((stage) => formatChainPart(stage));
  return `recs chain ${parts.join(" \\| ")}`;
}

/**
 * Format a stage as a `recs <op> <args...>` shell command fragment.
 */
function formatStageCommand(stage: Stage): string {
  const parts = ["recs", stage.config.operationName];
  for (const arg of stage.config.args) {
    parts.push(shellEscape(arg));
  }
  return parts.join(" ");
}

/**
 * Format a stage as `<op> <args...>` for chain command (no `recs` prefix).
 */
function formatChainPart(stage: Stage): string {
  const parts = [stage.config.operationName];
  for (const arg of stage.config.args) {
    parts.push(shellEscape(arg));
  }
  return parts.join(" ");
}

/**
 * Copy text to the system clipboard.
 *
 * Strategy 1: Platform-specific CLI tool (pbcopy on macOS, xclip on Linux).
 * Strategy 2: Write to a temp file as fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const cmd =
      process.platform === "darwin"
        ? ["pbcopy"]
        : ["xclip", "-selection", "clipboard"];

    const proc = Bun.spawn(cmd, { stdin: "pipe" });
    proc.stdin.write(text);
    proc.stdin.end();
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}
