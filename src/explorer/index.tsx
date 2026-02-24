/**
 * Explorer Pipeline Builder for RecordStream.
 *
 * This is the main entry point. It creates an Ink renderer
 * and mounts the root App component.
 */

import { render } from "ink";
import { App } from "./components/App.tsx";

export interface ExplorerOptions {
  /** Input file path to open immediately */
  inputFile?: string;
  /** Session ID to resume */
  sessionId?: string;
  /** Initial pipeline command (e.g., "grep x=1 | sort --key y") */
  pipeline?: string;
}

/**
 * Launch the Explorer pipeline builder.
 *
 * Creates an Ink renderer, mounts the React app, and waits until
 * the user exits. Ink handles terminal restoration automatically.
 */
export async function launchExplorer(options: ExplorerOptions): Promise<void> {
  let instance: ReturnType<typeof render> | null = null;

  try {
    instance = render(<App options={options} />, {
      exitOnCtrlC: false,
    });
  } catch (err) {
    process.stderr.write(
      `Explorer failed to create renderer: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(err.stack + "\n");
    }
    process.exit(1);
  }

  // Handle uncaught errors during rendering — restore terminal
  const cleanup = (err: unknown) => {
    try {
      instance?.unmount();
    } catch {
      // Best-effort cleanup
    }
    process.stderr.write(
      `Explorer crashed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    if (err instanceof Error && err.stack) {
      process.stderr.write(err.stack + "\n");
    }
    process.exit(1);
  };

  process.on("uncaughtException", cleanup);
  process.on("unhandledRejection", cleanup);

  // Wait until the Ink app exits (user quits with q or Ctrl+C)
  await instance.waitUntilExit();
}
