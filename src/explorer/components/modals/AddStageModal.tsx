/**
 * AddStageModal — categorized operation picker with fuzzy search + preview,
 * plus a stream preview panel showing current records.
 *
 * Layout:
 * - Top: title bar + search input
 * - Middle: two columns — operations list (left), operation preview (right)
 * - Bottom: stream preview showing records at the current pipeline position
 *
 * Tab toggles focus between operations and stream preview.
 * In stream preview: ↑↓ navigate records, Enter zooms into a record detail.
 * Enter selects the operation (when operations focused). Esc cancels (or exits zoom).
 */

import { useState, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { allDocs } from "../../../cli/operation-registry.ts";
import type { CommandDoc } from "../../../types/CommandDoc.ts";
import type { Record } from "../../../Record.ts";
import type { JsonValue } from "../../../types/json.ts";
import { fuzzyFilter } from "../../utils/fuzzy-match.ts";
import { theme } from "../../theme.ts";

export interface AddStageModalProps {
  /** Called when user selects an operation */
  onSelect: (operationName: string) => void;
  /** Called when user cancels (Esc) */
  onCancel: () => void;
  /** Label shown in title (e.g., "after: grep") */
  afterLabel?: string;
  /** Records at the current pipeline position (for stream preview) */
  records?: Record[];
  /** Field names from the current cached result */
  fieldNames?: string[];
}

/** Operations hidden from the picker (internal-only). */
const HIDDEN_OPS = new Set(["chain"]);

interface CategoryGroup {
  label: string;
  docs: CommandDoc[];
}

function groupByCategory(docs: CommandDoc[]): CategoryGroup[] {
  const transform: CommandDoc[] = [];
  const input: CommandDoc[] = [];
  const output: CommandDoc[] = [];

  for (const doc of docs) {
    if (HIDDEN_OPS.has(doc.name)) continue;
    switch (doc.category) {
      case "transform":
        transform.push(doc);
        break;
      case "input":
        input.push(doc);
        break;
      case "output":
        output.push(doc);
        break;
    }
  }

  const groups: CategoryGroup[] = [];
  if (transform.length > 0) groups.push({ label: "TRANSFORM", docs: transform });
  if (input.length > 0) groups.push({ label: "INPUT", docs: input });
  if (output.length > 0) groups.push({ label: "OUTPUT", docs: output });
  return groups;
}

function formatPreview(doc: CommandDoc): string {
  const lines: string[] = [];

  lines.push(doc.name);
  lines.push(doc.description);
  lines.push("");

  if (doc.options.length > 0) {
    lines.push("Options:");
    for (const opt of doc.options) {
      const flags = opt.flags.join(", ");
      const arg = opt.argument ? ` <${opt.argument}>` : "";
      lines.push(`  ${flags}${arg}`);
      lines.push(`    ${opt.description}`);
    }
    lines.push("");
  }

  if (doc.examples.length > 0) {
    lines.push("Example:");
    const ex = doc.examples[0]!;
    lines.push(`  ${ex.command}`);
    if (ex.description) {
      lines.push(`  # ${ex.description}`);
    }
  }

  return lines.join("\n");
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

type FocusArea = "operations" | "preview";

export function AddStageModal({
  onSelect,
  onCancel,
  afterLabel,
  records,
  fieldNames,
}: AddStageModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea>("operations");
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

  // Filter docs by fuzzy search, then group by category.
  // When a query is active, show a flat list sorted by relevance
  // instead of forcing category order (which buries exact matches).
  const filteredDocs = useMemo(
    () =>
      fuzzyFilter(
        allDocs.filter((d) => !HIDDEN_OPS.has(d.name)),
        query,
        (d) => `${d.name} ${d.description}`,
        {
          getName: (d) => d.name,
          minScore: 50,
        },
      ),
    [query],
  );

  const groups = useMemo(() => {
    if (query.length > 0) {
      // Active search: show flat list sorted by fuzzy relevance
      return filteredDocs.length > 0
        ? [{ label: "RESULTS", docs: filteredDocs }]
        : [];
    }
    return groupByCategory(filteredDocs);
  }, [filteredDocs, query]);

  // Flat list of visible docs (for index-based navigation)
  const flatList = useMemo(
    () => groups.flatMap((g) => g.docs),
    [groups],
  );

  const selected = flatList[selectedIndex];

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
  useInput((_input, key) => {
    // In zoom mode, let the secondary handler take over entirely
    if (zoomedIndex !== null) return;

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.tab) {
      if (hasRecords) {
        setFocusArea((f) => (f === "operations" ? "preview" : "operations"));
      }
      return;
    }

    if (focusArea === "operations") {
      if (key.upArrow) {
        setSelectedIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(flatList.length - 1, i + 1));
        return;
      }
      if (key.return) {
        if (selected) {
          onSelect(selected.name);
        }
        return;
      }
    }
  });

  // ── Keyboard: zoom mode + preview navigation ─────────────────
  // Active only when TextInput is NOT focused (preview/zoom).
  // This handler may match printable chars (j/k/h/l/space) so it must
  // be disabled while the user is typing in the search box.
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
  }, { isActive: focusArea !== "operations" || zoomedIndex !== null });

  const titleText = afterLabel
    ? `Add Stage (after: ${afterLabel})`
    : "Add Stage";

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
      width="80%"
      height="80%"
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      {/* Title bar */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text}>{titleText}</Text>
        <Text color={theme.overlay0}>[Esc] cancel{hasRecords ? "  [Tab] switch panel" : ""}</Text>
      </Box>

      {/* Search input */}
      <Box marginTop={1}>
        <Text color={theme.text}>Search: </Text>
        <TextInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setSelectedIndex(0);
          }}
          placeholder="type to filter..."
          focus={focusArea === "operations"}
        />
      </Box>

      {/* Two-column content: operations + op preview */}
      <Box flexDirection="row" flexGrow={1} marginTop={1}>
        {/* Left: categorized list */}
        <Box width="50%" flexDirection="column" overflow="hidden">
          {groups.map((group) => (
            <Box key={group.label} flexDirection="column">
              <Text color={theme.subtext0} bold>{group.label}</Text>
              {group.docs.map((doc) => {
                const idx = flatList.indexOf(doc);
                const isSel = idx === selectedIndex && focusArea === "operations";
                return (
                  <Text
                    key={doc.name}
                    backgroundColor={isSel ? theme.surface0 : undefined}
                    color={isSel ? theme.text : (idx === selectedIndex ? theme.subtext0 : theme.subtext0)}
                  >
                    {isSel ? "> " : "  "}
                    {doc.name}
                  </Text>
                );
              })}
            </Box>
          ))}
          {flatList.length === 0 && (
            <Text color={theme.overlay0}>No matching operations</Text>
          )}
        </Box>

        {/* Right: preview pane */}
        <Box flexGrow={1} marginLeft={2} flexDirection="column" overflow="hidden">
          {selected ? (
            <Text color={theme.text}>{formatPreview(selected)}</Text>
          ) : (
            <Text color={theme.overlay0}>Select an operation to see details</Text>
          )}
        </Box>
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
              Stream Preview
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
          {focusArea === "operations"
            ? "↑↓:navigate  Enter:select  Esc:cancel  Type to search"
            : "↑↓:navigate  Enter:zoom record  Esc:cancel  Tab:operations"}
        </Text>
      </Box>
    </Box>
  );
}
