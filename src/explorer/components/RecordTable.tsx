import { useMemo } from "react";
import { Box, Text } from "ink";
import type { CachedResult } from "../model/types.ts";
import { theme } from "../theme.ts";

export interface RecordTableProps {
  result: CachedResult;
  scrollOffset: number;
  maxRows?: number;
  highlightedColumn?: number | null;
}

export function RecordTable({
  result,
  scrollOffset,
  maxRows = 50,
  highlightedColumn = null,
}: RecordTableProps) {
  const fields = result.fieldNames;

  // Memoize the visible record slice
  const visibleRecords = useMemo(
    () => result.records.slice(scrollOffset, scrollOffset + maxRows),
    [result.records, scrollOffset, maxRows],
  );

  // Memoize column width calculation — O(records × fields)
  const colWidths = useMemo(() => {
    if (fields.length === 0) return [];
    const COL_MIN = 4;
    const COL_MAX = 30;
    return fields.map((field) => {
      let maxWidth = field.length;
      for (const record of visibleRecords) {
        const val = record.get(field);
        const str = val === null || val === undefined ? "" : String(val);
        maxWidth = Math.max(maxWidth, str.length);
      }
      return Math.min(Math.max(maxWidth, COL_MIN), COL_MAX);
    });
  }, [fields, visibleRecords]);

  // Memoize header cells
  const headerCells = useMemo(
    () => fields.map((f, i) => f.padEnd(colWidths[i]!).slice(0, colWidths[i]!)),
    [fields, colWidths],
  );

  // Memoize row data
  const rowsData = useMemo(
    () =>
      visibleRecords.map((record, idx) => {
        const rowNum = String(scrollOffset + idx + 1).padStart(3);
        const cells = fields.map((field, i) => {
          const val = record.get(field);
          const str = val === null || val === undefined ? "" : String(val);
          return str.padEnd(colWidths[i]!).slice(0, colWidths[i]!);
        });
        return { rowNum, cells };
      }),
    [visibleRecords, scrollOffset, fields, colWidths],
  );

  if (result.records.length === 0) {
    return <Text color={theme.overlay0}>(no records)</Text>;
  }
  if (fields.length === 0) {
    return <Text color={theme.overlay0}>(no fields)</Text>;
  }

  const footer =
    result.recordCount > scrollOffset + maxRows
      ? `... (${result.recordCount} total)`
      : "";

  // When no column is highlighted, render plain text (fast path)
  if (highlightedColumn === null || highlightedColumn < 0 || highlightedColumn >= fields.length) {
    const header = "#   " + headerCells.join("  ");
    const rows = rowsData.map(
      ({ rowNum, cells }) => `${rowNum} ${cells.join("  ")}`,
    );
    return (
      <Box flexDirection="column">
        <Text color={theme.lavender} bold>{header}</Text>
        {rows.map((row, i) => (
          <Text key={i} color={i === 0 ? theme.text : theme.subtext0}>{row}</Text>
        ))}
        {footer ? <Text color={theme.overlay0}>{footer}</Text> : null}
      </Box>
    );
  }

  // Column highlight: render each row with segments so the highlighted column stands out
  const hi = highlightedColumn;

  function renderSegments(prefix: string, cells: string[], isHeader: boolean) {
    // Build before, highlighted, and after text segments
    const before = cells.slice(0, hi).join("  ");
    const highlighted = cells[hi]!;
    const after = cells.slice(hi + 1).join("  ");

    const beforeText = prefix + (before ? before + "  " : "");
    const afterText = after ? "  " + after : "";

    return (
      <Text>
        <Text color={isHeader ? theme.overlay0 : theme.text}>{beforeText}</Text>
        <Text backgroundColor={theme.surface0} color={theme.lavender} bold>{highlighted}</Text>
        <Text color={isHeader ? theme.overlay0 : theme.text}>{afterText}</Text>
      </Text>
    );
  }

  return (
    <Box flexDirection="column">
      {renderSegments("#   ", headerCells, true)}
      {rowsData.map(({ rowNum, cells }, i) =>
        <Box key={i}>{renderSegments(`${rowNum} `, cells, false)}</Box>,
      )}
      {footer ? <Text color={theme.surface1}>{footer}</Text> : null}
      <Box marginTop={1}>
        <Text>
          <Text color={theme.peach}>Column: {fields[hi]}</Text>
          <Text color={theme.overlay0}> | </Text>
          <Text color={theme.lavender}>g</Text><Text color={theme.subtext0}>:grep </Text>
          <Text color={theme.lavender}>s</Text><Text color={theme.subtext0}>:sort </Text>
          <Text color={theme.lavender}>c</Text><Text color={theme.subtext0}>:collate </Text>
          <Text color={theme.lavender}>F</Text><Text color={theme.subtext0}>:spotlight </Text>
          <Text color={theme.lavender}>Esc</Text><Text color={theme.subtext0}>:clear</Text>
        </Text>
      </Box>
    </Box>
  );
}
