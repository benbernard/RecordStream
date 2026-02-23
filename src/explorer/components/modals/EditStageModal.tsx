/**
 * EditStageModal — raw args text input for editing stage arguments,
 * plus a stream preview panel showing upstream records.
 *
 * Layout:
 * - Top: title bar (operation name + hints)
 * - Middle: args text input
 * - Bottom: stream preview showing upstream records (parent stage output)
 *
 * Tab toggles focus between args input and stream preview.
 * In stream preview: ↑↓ navigate records, Enter zooms into a record detail.
 * Enter (in args) confirms the edit. Esc cancels (or exits zoom).
 */

import { useCallback, useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { Record } from "../../../Record.ts";
import type { JsonValue } from "../../../types/json.ts";
import { theme } from "../../theme.ts";

export interface EditStageModalProps {
  /** The operation name being edited */
  operationName: string;
  /** Current args as a single string (space-separated) */
  currentArgs: string;
  /** Called when user confirms edit */
  onConfirm: (args: string[]) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Upstream records (output of the parent stage) */
  records?: Record[];
  /** Field names from the upstream cached result */
  fieldNames?: string[];
}

// ── Stream Preview helpers ──────────────────────────────────────

const PREVIEW_MAX_RECORDS = 5;
const COL_MIN = 4;
const COL_MAX = 20;

function computeColumnWidths(fields: string[], records: Record[]): number[] {
  return fields.map((field) => {
    let maxWidth = field.length;
    for (const record of records) {
      const val = record.get(field);
      const str = val === null || val === undefined ? "" : String(val);
      maxWidth = Math.max(maxWidth, str.length);
    }
    return Math.min(Math.max(maxWidth, COL_MIN), COL_MAX);
  });
}

// ── Record Zoom helpers (inline detail view) ────────────────────

function valueColor(value: JsonValue): string {
  if (value === null || value === undefined) return theme.overlay0;
  if (typeof value === "string") return theme.green;
  if (typeof value === "number") return theme.teal;
  if (typeof value === "boolean") return theme.yellow;
  return theme.text;
}

function formatValue(value: JsonValue): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === "object") return `Object(${Object.keys(value).length})`;
  return String(value);
}

interface TreeRow {
  depth: number;
  label: string;
  value: JsonValue;
  isContainer: boolean;
  path: string;
  childCount: number;
}

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
    const row: TreeRow = { depth, label, value, isContainer: true, path, childCount: keys.length };
    const rows: TreeRow[] = [row];
    if (!collapsed.has(path)) {
      for (const key of keys) {
        rows.push(...flattenValue(value[key]!, collapsed, path, depth + 1, key));
      }
    }
    return rows;
  }

  if (Array.isArray(value)) {
    const row: TreeRow = { depth, label, value, isContainer: true, path, childCount: value.length };
    const rows: TreeRow[] = [row];
    if (!collapsed.has(path)) {
      for (let i = 0; i < value.length; i++) {
        rows.push(...flattenValue(value[i]!, collapsed, path, depth + 1, `[${i}]`));
      }
    }
    return rows;
  }

  return [{ depth, label, value, isContainer: false, path, childCount: 0 }];
}

function flattenRecord(record: Record, collapsed: Set<string>): TreeRow[] {
  const data = record.toJSON();
  const rows: TreeRow[] = [];
  for (const key of Object.keys(data)) {
    rows.push(...flattenValue(data[key]!, collapsed, "", 0, key));
  }
  return rows;
}

// ── Focus areas ─────────────────────────────────────────────────

type FocusArea = "args" | "preview";

export function EditStageModal({
  operationName,
  currentArgs,
  onConfirm,
  onCancel,
  records,
  fieldNames,
}: EditStageModalProps) {
  const [value, setValue] = useState(currentArgs);
  const [focusArea, setFocusArea] = useState<FocusArea>("args");
  const [previewCursor, setPreviewCursor] = useState(0);

  // Zoom state: which record index is zoomed (null = no zoom)
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [zoomCursorRow, setZoomCursorRow] = useState(0);
  const [zoomCollapsed, setZoomCollapsed] = useState<Set<string>>(() => new Set());

  const hasRecords = records && records.length > 0;
  const previewRecords = useMemo(
    () => (records ?? []).slice(0, PREVIEW_MAX_RECORDS),
    [records],
  );

  const handleSubmit = useCallback(
    (val: string) => {
      const args = parseArgs(val);
      onConfirm(args);
    },
    [onConfirm],
  );

  // Zoomed record tree rows
  const zoomedRecord = zoomedIndex !== null ? previewRecords[zoomedIndex] : undefined;
  const zoomRows = useMemo(
    () => (zoomedRecord ? flattenRecord(zoomedRecord, zoomCollapsed) : []),
    [zoomedRecord, zoomCollapsed],
  );

  const toggleZoomCollapse = useCallback(
    (path: string) => {
      setZoomCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    },
    [],
  );

  // ── Keyboard: non-printable keys (always active) ──────────────
  // This handler ONLY checks key.* flags, never the `input` string,
  // so it cannot intercept printable characters that TextInput needs.
  // Enter is handled here (not via TextInput's onSubmit) because
  // ink-text-input's internal useInput handler is recreated every render
  // without useCallback, causing brief deregistration windows where
  // keypress events can be missed.
  useInput((_input, key) => {
    // In zoom mode, let the secondary handler take over entirely
    if (zoomedIndex !== null) return;

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && focusArea === "args") {
      handleSubmit(value);
      return;
    }

    if (key.tab) {
      if (hasRecords) {
        setFocusArea((f) => (f === "args" ? "preview" : "args"));
      }
      return;
    }
  });

  // ── Keyboard: zoom mode + preview navigation ─────────────────
  // Active only when TextInput is NOT focused (preview/zoom).
  // This handler may match printable chars (j/k/h/l/space) so it must
  // be disabled while the user is typing in the args box.
  useInput((input, key) => {
    // ── Zoom mode input handling ──────────────────────────────
    if (zoomedIndex !== null) {
      if (key.escape) {
        setZoomedIndex(null);
        setZoomCursorRow(0);
        setZoomCollapsed(new Set());
        return;
      }
      if (key.upArrow || input === "k") {
        setZoomCursorRow((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        setZoomCursorRow((i) => Math.min(zoomRows.length - 1, i + 1));
        return;
      }
      if (input === " ") {
        const row = zoomRows[zoomCursorRow];
        if (row?.isContainer) {
          toggleZoomCollapse(row.path);
        }
        return;
      }
      // ←/→ navigate between records while zoomed
      if (key.leftArrow || input === "h") {
        if (zoomedIndex > 0) {
          setZoomedIndex((i) => i! - 1);
          setZoomCursorRow(0);
          setZoomCollapsed(new Set());
        }
        return;
      }
      if (key.rightArrow || input === "l") {
        if (zoomedIndex < previewRecords.length - 1) {
          setZoomedIndex((i) => i! + 1);
          setZoomCursorRow(0);
          setZoomCollapsed(new Set());
        }
        return;
      }
      return; // Absorb all other input while zoomed
    }

    // ── Preview navigation ────────────────────────────────────
    if (focusArea === "preview") {
      if (key.upArrow || input === "k") {
        setPreviewCursor((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        setPreviewCursor((i) => Math.min(previewRecords.length - 1, i + 1));
        return;
      }
      if (key.return) {
        if (previewRecords.length > 0) {
          setZoomedIndex(previewCursor);
          setZoomCursorRow(0);
          setZoomCollapsed(new Set());
        }
        return;
      }
    }
  }, { isActive: focusArea !== "args" || zoomedIndex !== null });

  // ── Zoom view (replaces normal content) ────────────────────
  if (zoomedIndex !== null && zoomedRecord) {
    const viewportHeight = 20;
    let scrollTop = Math.max(0, zoomCursorRow - Math.floor(viewportHeight / 2));
    if (scrollTop + viewportHeight > zoomRows.length) {
      scrollTop = Math.max(0, zoomRows.length - viewportHeight);
    }
    const visibleRows = zoomRows.slice(scrollTop, scrollTop + viewportHeight);

    return (
      <Box
        flexDirection="column"
        width="80%"
        height="80%"
        borderStyle="single"
        borderColor={theme.surface1}
        padding={1}
      >
        {/* Header */}
        <Box height={1} flexDirection="row" justifyContent="space-between">
          <Text color={theme.text}>
            <Text bold>Record #{zoomedIndex + 1}</Text>
            <Text color={theme.subtext0}> of {previewRecords.length}</Text>
          </Text>
          <Text color={theme.overlay0}>[Esc] back  [←/→] prev/next</Text>
        </Box>

        {/* Tree view */}
        <Box flexGrow={1} flexDirection="column" marginTop={1} overflow="hidden">
          {visibleRows.map((row, vi) => {
            const actualIdx = scrollTop + vi;
            const isSelected = actualIdx === zoomCursorRow;
            const indent = "  ".repeat(row.depth);
            const marker = row.isContainer
              ? zoomCollapsed.has(row.path)
                ? "▶ "
                : "▼ "
              : "  ";

            const labelText = `${indent}${marker}${row.label}`;

            if (row.isContainer) {
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
          {zoomRows.length === 0 && (
            <Text color={theme.overlay0}>(empty record)</Text>
          )}
        </Box>

        {/* Footer */}
        <Box height={1} marginTop={1}>
          <Text color={theme.overlay0}>
            ↑↓:navigate  Space:toggle  ←→:prev/next record  Esc:back
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Normal modal layout ────────────────────────────────────

  // Compute stream preview table data
  const previewFields = fieldNames ?? [];
  const previewColWidths = useMemo(
    () => computeColumnWidths(previewFields, previewRecords),
    [previewFields, previewRecords],
  );

  return (
    <Box
      flexDirection="column"
      width="70%"
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      {/* Title bar */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text}>
          Edit: <Text bold>{operationName}</Text>
        </Text>
        <Text color={theme.overlay0}>[Esc] cancel{hasRecords ? "  [Tab] switch panel" : ""}</Text>
      </Box>

      {/* Args input */}
      <Box marginTop={1}>
        <Text color={theme.text}>Args: </Text>
        <TextInput
          value={value}
          onChange={setValue}
          placeholder="--key value ..."
          focus={focusArea === "args"}
        />
      </Box>

      {/* Stream preview */}
      {hasRecords && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={focusArea === "preview" ? theme.blue : theme.surface1}
          paddingX={1}
          marginTop={1}
          height={PREVIEW_MAX_RECORDS + 4}
        >
          <Box height={1} flexDirection="row" justifyContent="space-between">
            <Text color={focusArea === "preview" ? theme.blue : theme.subtext0} bold>
              Upstream Records
            </Text>
            <Text color={theme.overlay0}>
              {records!.length} record{records!.length !== 1 ? "s" : ""}
              {records!.length > PREVIEW_MAX_RECORDS ? ` (showing ${PREVIEW_MAX_RECORDS})` : ""}
            </Text>
          </Box>

          {previewFields.length > 0 ? (
            <Box flexDirection="column" overflow="hidden">
              {/* Header row */}
              <Text color={theme.overlay0}>
                {"  #   "}
                {previewFields.map((f, i) =>
                  f.padEnd(previewColWidths[i]!).slice(0, previewColWidths[i]!),
                ).join("  ")}
              </Text>
              {/* Record rows */}
              {previewRecords.map((record, ri) => {
                const isSel = ri === previewCursor && focusArea === "preview";
                const prefix = isSel ? "> " : "  ";
                const rowNum = String(ri + 1).padStart(3);
                const cells = previewFields.map((field, fi) => {
                  const val = record.get(field);
                  const str = val === null || val === undefined ? "" : String(val);
                  return str.padEnd(previewColWidths[fi]!).slice(0, previewColWidths[fi]!);
                });
                return (
                  <Text
                    key={ri}
                    backgroundColor={isSel ? theme.surface0 : undefined}
                    color={isSel ? theme.text : theme.subtext0}
                  >
                    {prefix}{rowNum} {cells.join("  ")}
                  </Text>
                );
              })}
            </Box>
          ) : (
            <Text color={theme.overlay0}>(no fields)</Text>
          )}
        </Box>
      )}

      {/* Footer hint */}
      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>
          {focusArea === "args"
            ? `Enter:confirm  Esc:cancel${hasRecords ? "  Tab:preview records" : ""}`
            : "↑↓:navigate  Enter:zoom record  Tab:edit args  Esc:cancel"}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Parse a string of arguments, respecting single and double quotes.
 * Returns an array of argument strings.
 */
function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}
