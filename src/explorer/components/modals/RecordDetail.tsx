/**
 * RecordDetail — full-screen tree view for exploring a single record's
 * nested JSON structure.
 *
 * Features:
 * - Collapsible objects/arrays (Space to toggle, ▼ expanded / ▶ collapsed)
 * - Up/down navigation through visible fields
 * - ←/→ to navigate to prev/next record without closing
 * - `y` to copy the value at cursor to clipboard
 * - Color coding: strings green, numbers teal, booleans yellow, null dim
 * - 2-space indentation per nesting level
 * - Header shows "Record #N" and record navigation hint
 */

import { useState, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import type { JsonValue } from "../../../types/json.ts";
import type { Record } from "../../../Record.ts";
import { copyToClipboard } from "../../model/serialization.ts";
import { theme } from "../../theme.ts";

export interface RecordDetailProps {
  records: Record[];
  initialIndex: number;
  onClose: () => void;
  onShowStatus?: (msg: string) => void;
}

/** A flattened row in the tree view. */
interface TreeRow {
  /** Indentation depth (0 = root fields) */
  depth: number;
  /** The field key or array index label */
  label: string;
  /** The raw JSON value at this node */
  value: JsonValue;
  /** Whether this node is an object or array (can be collapsed) */
  isContainer: boolean;
  /** Unique path key for tracking collapsed state */
  path: string;
  /** Number of direct children (for the collapsed summary) */
  childCount: number;
}

/**
 * Flatten a JSON value into tree rows, respecting collapsed state.
 */
function flattenValue(
  value: JsonValue,
  collapsed: Set<string>,
  parentPath: string,
  depth: number,
  label: string,
): TreeRow[] {
  const path = parentPath ? `${parentPath}.${label}` : label;

  if (value === null || value === undefined) {
    return [{ depth, label, value: null, isContainer: false, path, childCount: 0 }];
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value);
    const row: TreeRow = {
      depth,
      label,
      value,
      isContainer: true,
      path,
      childCount: keys.length,
    };
    const rows: TreeRow[] = [row];

    if (!collapsed.has(path)) {
      for (const key of keys) {
        rows.push(...flattenValue(value[key]!, collapsed, path, depth + 1, key));
      }
    }
    return rows;
  }

  if (Array.isArray(value)) {
    const row: TreeRow = {
      depth,
      label,
      value,
      isContainer: true,
      path,
      childCount: value.length,
    };
    const rows: TreeRow[] = [row];

    if (!collapsed.has(path)) {
      for (let i = 0; i < value.length; i++) {
        rows.push(...flattenValue(value[i]!, collapsed, path, depth + 1, `[${i}]`));
      }
    }
    return rows;
  }

  // Primitive value
  return [{ depth, label, value, isContainer: false, path, childCount: 0 }];
}

/**
 * Flatten an entire record into tree rows.
 */
function flattenRecord(record: Record, collapsed: Set<string>): TreeRow[] {
  const data = record.toJSON();
  const rows: TreeRow[] = [];
  for (const key of Object.keys(data)) {
    rows.push(...flattenValue(data[key]!, collapsed, "", 0, key));
  }
  return rows;
}

/** Color a value based on its JSON type. */
function valueColor(value: JsonValue): string {
  if (value === null || value === undefined) return theme.overlay0;
  if (typeof value === "string") return theme.green;
  if (typeof value === "number") return theme.teal;
  if (typeof value === "boolean") return theme.yellow;
  return theme.text;
}

/** Format a value for display (single line). */
function formatValue(value: JsonValue): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") return `Object(${Object.keys(value).length})`;
  return String(value);
}

export function RecordDetail({
  records,
  initialIndex,
  onClose,
  onShowStatus,
}: RecordDetailProps) {
  const [recordIndex, setRecordIndex] = useState(initialIndex);
  const [cursorRow, setCursorRow] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const record = records[recordIndex];
  const rows = useMemo(
    () => (record ? flattenRecord(record, collapsed) : []),
    [record, collapsed],
  );

  const toggleCollapse = useCallback(
    (path: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [],
  );

  useInput((input, key) => {
    // Close
    if (key.escape || input === "q") {
      onClose();
      return;
    }

    // Navigation within tree
    if (key.upArrow || input === "k") {
      setCursorRow((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setCursorRow((i) => Math.min(rows.length - 1, i + 1));
      return;
    }

    // Toggle collapse
    if (input === " ") {
      const row = rows[cursorRow];
      if (row?.isContainer) {
        toggleCollapse(row.path);
      }
      return;
    }

    // Prev/next record
    if (key.leftArrow || input === "h") {
      if (recordIndex > 0) {
        setRecordIndex((i) => i - 1);
        setCursorRow(0);
        setCollapsed(new Set());
      }
      return;
    }
    if (key.rightArrow || input === "l") {
      if (recordIndex < records.length - 1) {
        setRecordIndex((i) => i + 1);
        setCursorRow(0);
        setCollapsed(new Set());
      }
      return;
    }

    // Copy value at cursor
    if (input === "y") {
      const row = rows[cursorRow];
      if (row) {
        const text =
          typeof row.value === "object" && row.value !== null
            ? JSON.stringify(row.value, null, 2)
            : String(row.value ?? "null");
        void copyToClipboard(text).then((ok) => {
          onShowStatus?.(ok ? "Copied value!" : "Clipboard failed");
        });
      }
      return;
    }
  });

  if (!record) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={theme.red} padding={1}>
        <Text color={theme.red}>No record at index {recordIndex}</Text>
      </Box>
    );
  }

  // Compute visible window (viewport scrolling)
  const viewportHeight = 30;
  let scrollTop = 0;
  // Center cursor in viewport when possible
  scrollTop = Math.max(0, cursorRow - Math.floor(viewportHeight / 2));
  if (scrollTop + viewportHeight > rows.length) {
    scrollTop = Math.max(0, rows.length - viewportHeight);
  }
  const visibleRows = rows.slice(scrollTop, scrollTop + viewportHeight);

  return (
    <Box
      flexDirection="column"
      width="80%"
      height="90%"
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      {/* Header */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text}>
          <Text bold>Record #{recordIndex + 1}</Text>
          <Text color={theme.subtext0}> of {records.length}</Text>
        </Text>
        <Text color={theme.overlay0}>[Esc] close  [←/→] prev/next</Text>
      </Box>

      {/* Tree view */}
      <Box flexGrow={1} flexDirection="column" marginTop={1} overflow="hidden">
        {visibleRows.map((row, vi) => {
          const actualIdx = scrollTop + vi;
          const isSelected = actualIdx === cursorRow;
          const indent = "  ".repeat(row.depth);
          const marker = row.isContainer
            ? collapsed.has(row.path)
              ? "▶ "
              : "▼ "
            : "  ";

          const labelText = `${indent}${marker}${row.label}`;

          if (row.isContainer && collapsed.has(row.path)) {
            // Collapsed container: show summary
            const summary = Array.isArray(row.value)
              ? `Array(${row.childCount})`
              : `Object(${row.childCount})`;
            return (
              <Text
                key={row.path}
                backgroundColor={isSelected ? theme.surface0 : undefined}
                color={theme.text}
              >
                {labelText}: <Text color={theme.subtext0}>{summary}</Text>
              </Text>
            );
          }

          if (row.isContainer) {
            // Expanded container: just show the label with marker
            const typeHint = Array.isArray(row.value)
              ? `Array(${row.childCount})`
              : `Object(${row.childCount})`;
            return (
              <Text
                key={row.path}
                backgroundColor={isSelected ? theme.surface0 : undefined}
                color={theme.text}
              >
                {labelText}: <Text color={theme.subtext0}>{typeHint}</Text>
              </Text>
            );
          }

          // Leaf value
          return (
            <Text
              key={row.path}
              backgroundColor={isSelected ? theme.surface0 : undefined}
              color={theme.text}
            >
              {labelText}: <Text color={valueColor(row.value)}>{formatValue(row.value)}</Text>
            </Text>
          );
        })}
        {rows.length === 0 && (
          <Text color={theme.overlay0}>(empty record)</Text>
        )}
      </Box>

      {/* Footer */}
      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>
          ↑↓:navigate  Space:toggle  ←→:prev/next record  y:copy  Esc:close
        </Text>
      </Box>
    </Box>
  );
}
