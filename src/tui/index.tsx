/**
 * TUI Pipeline Builder for RecordStream.
 *
 * This is the main React application entry point. It creates an OpenTUI
 * renderer and mounts the root App component.
 */

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./components/App.tsx";

export interface TuiOptions {
  /** Input file path to open immediately */
  inputFile?: string;
  /** Session ID to resume */
  sessionId?: string;
  /** Initial pipeline command (e.g., "grep x=1 | sort --key y") */
  pipeline?: string;
}

/**
 * Launch the TUI pipeline builder.
 *
 * Creates an OpenTUI renderer, mounts the React app, and handles
 * clean shutdown on exit.
 */
export async function launchTui(options: TuiOptions): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
  });

  const root = createRoot(renderer);
  root.render(<App options={options} renderer={renderer} />);
}
