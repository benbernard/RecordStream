import type { CachedResult } from "../model/types.ts";

export interface RecordTableProps {
  result: CachedResult;
  scrollOffset: number;
  maxRows?: number;
}

export function RecordTable({
  result,
  scrollOffset,
  maxRows = 50,
}: RecordTableProps) {
  if (result.records.length === 0) {
    return <text fg="#888888">(no records)</text>;
  }

  // Compute column widths from field names + data
  const fields = result.fieldNames;
  if (fields.length === 0) {
    return <text fg="#888888">(no fields)</text>;
  }

  const visibleRecords = result.records.slice(
    scrollOffset,
    scrollOffset + maxRows,
  );

  // Build header
  const header = "#   " + fields.map((f) => f.padEnd(15).slice(0, 15)).join("  ");

  // Build rows
  const rows = visibleRecords.map((record, idx) => {
    const rowNum = String(scrollOffset + idx + 1).padStart(3);
    const cells = fields.map((field) => {
      const val = record.get(field);
      const str = val === null || val === undefined ? "" : String(val);
      return str.padEnd(15).slice(0, 15);
    });
    return `${rowNum} ${cells.join("  ")}`;
  });

  const footer =
    result.recordCount > scrollOffset + maxRows
      ? `... (${result.recordCount} total)`
      : "";

  return (
    <box flexDirection="column">
      <text fg="#888888">{header}</text>
      {rows.map((row, i) => (
        <text key={i}>{row}</text>
      ))}
      {footer ? <text fg="#666666">{footer}</text> : null}
    </box>
  );
}
