import type { PipelineState } from "../model/types.ts";
import { getCursorStage, getCursorOutput } from "../model/selectors.ts";
import { InspectorHeader } from "./InspectorHeader.tsx";
import { RecordTable } from "./RecordTable.tsx";

export interface InspectorPanelProps {
  state: PipelineState;
}

function PrettyPrintView({ result }: { result: { records: import("../model/types.ts").CachedResult["records"]; recordCount: number }; scrollOffset: number }) {
  if (result.records.length === 0) {
    return <text fg="#888888">(no records)</text>;
  }
  // Show first few records as pretty-printed JSON
  const lines = result.records.slice(0, 20).map((r, i) =>
    `Record ${i + 1}: ${JSON.stringify(r.toJSON(), null, 2)}`,
  );
  return (
    <box flexDirection="column">
      {lines.map((line, i) => (
        <text key={i}>{line}</text>
      ))}
    </box>
  );
}

function JsonView({ result }: { result: { records: import("../model/types.ts").CachedResult["records"] } }) {
  if (result.records.length === 0) {
    return <text fg="#888888">(no records)</text>;
  }
  const lines = result.records.slice(0, 50).map((r) => r.toString());
  return (
    <box flexDirection="column">
      {lines.map((line, i) => (
        <text key={i}>{line}</text>
      ))}
    </box>
  );
}

export function InspectorPanel({ state }: InspectorPanelProps) {
  const isFocused = state.focusedPanel === "inspector";
  const stage = getCursorStage(state);
  const output = getCursorOutput(state);

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? "#FFFFFF" : "#555555"}
    >
      <InspectorHeader state={state} />

      <scrollbox flexDirection="column" flexGrow={1}>
        {!stage ? (
          <text fg="#666666">Select a stage to inspect its output</text>
        ) : state.executing ? (
          <text fg="#FFCC00">Computing...</text>
        ) : state.lastError?.stageId === stage.id ? (
          <box flexDirection="column">
            <text fg="#FF4444">Error: {state.lastError.message}</text>
          </box>
        ) : !output ? (
          <text fg="#666666">No cached output. Press r to execute.</text>
        ) : state.inspector.viewMode === "table" ? (
          <RecordTable
            result={output}
            scrollOffset={state.inspector.scrollOffset}
          />
        ) : state.inspector.viewMode === "prettyprint" ? (
          <PrettyPrintView
            result={output}
            scrollOffset={state.inspector.scrollOffset}
          />
        ) : state.inspector.viewMode === "json" ? (
          <JsonView result={output} />
        ) : (
          <text fg="#888888">Schema view (coming soon)</text>
        )}
      </scrollbox>
    </box>
  );
}
