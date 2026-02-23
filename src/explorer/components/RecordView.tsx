/**
 * RecordView — view mode router for the inspector panel.
 *
 * Renders the appropriate view based on the current inspector view mode:
 * - table: RecordTable (columnar display)
 * - prettyprint: pretty-printed JSON per record
 * - json: raw JSON lines
 * - schema: SchemaView (field analysis)
 *
 * The `t` key cycles through modes (handled in App.tsx global keyboard).
 */

import { useMemo, memo } from "react";
import { Box, Text } from "ink";
import type { CachedResult, InspectorState } from "../model/types.ts";
import { RecordTable } from "./RecordTable.tsx";
import { SchemaView } from "./SchemaView.tsx";
import { theme } from "../theme.ts";

export interface RecordViewProps {
  result: CachedResult;
  viewMode: InspectorState["viewMode"];
  scrollOffset: number;
  highlightedColumn?: number | null;
}

const PrettyPrintView = memo(function PrettyPrintView({ result, scrollOffset }: { result: CachedResult; scrollOffset: number }) {
  const pageSize = 20;
  const start = scrollOffset;
  const end = Math.min(start + pageSize, result.records.length);

  const lines = useMemo(
    () => result.records.slice(start, end).map((r, i) =>
      `Record ${start + i + 1}: ${JSON.stringify(r.toJSON(), null, 2)}`),
    [result.records, start, end],
  );

  if (result.records.length === 0) {
    return <Text color={theme.overlay0}>(no records)</Text>;
  }
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={theme.text}>{line}</Text>
      ))}
      {result.recordCount > end && (
        <Text color={theme.overlay0}>... ({result.recordCount} total, showing {start + 1}–{end})</Text>
      )}
    </Box>
  );
});

const JsonView = memo(function JsonView({ result, scrollOffset }: { result: CachedResult; scrollOffset: number }) {
  const pageSize = 50;
  const start = scrollOffset;
  const end = Math.min(start + pageSize, result.records.length);

  const lines = useMemo(
    () => result.records.slice(start, end).map((r) => r.toString()),
    [result.records, start, end],
  );

  if (result.records.length === 0) {
    return <Text color={theme.overlay0}>(no records)</Text>;
  }
  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Text key={i} color={theme.text}>{line}</Text>
      ))}
      {result.recordCount > end && (
        <Text color={theme.overlay0}>... ({result.recordCount} total, showing {start + 1}–{end})</Text>
      )}
    </Box>
  );
});

export const RecordView = memo(function RecordView({ result, viewMode, scrollOffset, highlightedColumn }: RecordViewProps) {
  switch (viewMode) {
    case "table":
      return (
        <RecordTable
          result={result}
          scrollOffset={scrollOffset}
          highlightedColumn={highlightedColumn}
        />
      );
    case "prettyprint":
      return <PrettyPrintView result={result} scrollOffset={scrollOffset} />;
    case "json":
      return <JsonView result={result} scrollOffset={scrollOffset} />;
    case "schema":
      return <SchemaView result={result} />;
    default:
      return <Text color={theme.overlay0}>Unknown view mode</Text>;
  }
});
