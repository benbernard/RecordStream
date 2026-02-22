/**
 * Root TUI application component.
 *
 * Renders the WelcomeScreen when no input is provided,
 * or the MainLayout when a pipeline is active.
 */

import type { CliRenderer } from "@opentui/core";
import type { TuiOptions } from "../index.tsx";

export interface AppProps {
  options: TuiOptions;
  renderer: CliRenderer;
}

export function App({ options, renderer: _renderer }: AppProps) {
  const hasInput = Boolean(options.inputFile || options.sessionId);

  if (!hasInput) {
    // TODO: WelcomeScreen component (Phase 1)
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text>Welcome to recs tui</text>
        <text> </text>
        <text>Open a file to start building a pipeline:</text>
        <text>  recs tui &lt;file&gt;</text>
        <text> </text>
        <text>Press q to quit</text>
      </box>
    );
  }

  // TODO: MainLayout component (Phase 1, Task #5)
  return (
    <box flexDirection="column" width="100%" height="100%">
      <box height={1}>
        <text>
          recs tui — {options.inputFile ?? `session: ${options.sessionId}`}
        </text>
      </box>
      <box flexDirection="row" flexGrow={1}>
        <box width={25} flexDirection="column" borderStyle="single">
          <text>Pipeline</text>
          <text>  (empty)</text>
        </box>
        <box flexGrow={1} borderStyle="single">
          <text>Inspector</text>
        </box>
      </box>
      <box height={1}>
        <text>a:add d:del e:edit u:undo x:export q:quit</text>
      </box>
    </box>
  );
}
