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

import { useState, useMemo, useCallback, useRef } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { allDocs } from "../../../cli/operation-registry.ts";
import type { CommandDoc } from "../../../types/CommandDoc.ts";
import type { Record } from "../../../Record.ts";
import type { JsonValue } from "../../../types/json.ts";
import { VimTextInput } from "../VimTextInput.tsx";
import { fuzzyFilter } from "../../utils/fuzzy-match.ts";
import { theme } from "../../theme.ts";

export interface AddStageModalProps {
  /** Called when user selects an operation, optionally with initial args */
  onSelect: (operationName: string, initialArgs?: string[]) => void;
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

function formatPreviewLines(doc: CommandDoc): string[] {
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

  return lines;
}

// ── Stream Preview helpers ──────────────────────────────────────

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
  const RECS_PREFIX = "recs ";
  const [query, setQuery] = useState(RECS_PREFIX);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusArea, setFocusArea] = useState<FocusArea>("operations");
  const [previewCursor, setPreviewCursor] = useState(0);
  const [docScroll, setDocScroll] = useState(0);

  // Zoom state: which record index is zoomed (null = no zoom)
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [zoomCursorRow, setZoomCursorRow] = useState(0);
  const [zoomCollapsed, setZoomCollapsed] = useState<Set<string>>(() => new Set());

  const hasRecords = records && records.length > 0;

  // ── Dynamic height computation ────────────────────────────────
  // Distribute available terminal rows between the operations list,
  // doc preview, and stream preview so the modal fills the screen.
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 40;

  // Fixed overhead lines:
  //   App chrome (TitleBar + ForkTabs + PipelineBar): 5
  //   Modal border(2) + padding(2): 4
  //   Title bar: 1, gap+search: 2, gap before 2-col: 1,
  //   scroll indicators in 2-col: 2, gap+footer: 2 → 8
  // Conditional:
  //   Stream preview: marginTop(1) + border(2) + title(1) + header(1) = 5
  const fixedOverhead = 5 + 4 + 8 + (hasRecords ? 5 : 0);
  const available = Math.max(0, termRows - fixedOverhead);

  let opViewport: number;
  let previewMaxRecords: number;
  if (!hasRecords) {
    opViewport = Math.max(6, available);
    previewMaxRecords = 0;
  } else {
    // Split: 70% to ops/doc panel, 30% to stream preview
    opViewport = Math.max(6, Math.floor(available * 0.7));
    previewMaxRecords = Math.max(2, available - opViewport);
  }
  // Doc viewport = lines available for doc text inside the column
  // (column height is opViewport + 2, minus 2 scroll indicators = opViewport)
  const docViewport = opViewport;

  const previewRecords = useMemo(
    () => (records ?? []).slice(0, previewMaxRecords),
    [records, previewMaxRecords],
  );

  // Detect recs vs shell mode based on query prefix
  const isRecsMode = query.startsWith(RECS_PREFIX);
  const recsFilter = isRecsMode ? query.slice(RECS_PREFIX.length) : "";
  // In shell mode, first word is command name, rest is args
  const shellParts = !isRecsMode ? query.trim().split(/\s+/) : [];
  const shellCommand = shellParts[0] ?? "";
  const shellArgs = shellParts.slice(1).join(" ");

  // Filter docs by fuzzy search, then group by category.
  // When a query is active, show a flat list sorted by relevance
  // instead of forcing category order (which buries exact matches).
  // Only fuzzy-match the first word so typing args after the op name
  // (e.g., "recs grep --key foo") doesn't break the match.
  const recsFilterWord = recsFilter.split(/\s+/)[0] ?? "";
  const filteredDocs = useMemo(
    () =>
      isRecsMode
        ? fuzzyFilter(
            allDocs.filter((d) => !HIDDEN_OPS.has(d.name)),
            recsFilterWord,
            (d) => `${d.name} ${d.description}`,
            {
              getName: (d) => d.name,
              minScore: 50,
            },
          )
        : [],
    [isRecsMode, recsFilterWord],
  );

  const groups = useMemo(() => {
    if (!isRecsMode) return [];
    if (recsFilterWord.length > 0) {
      // Active search: show flat list sorted by fuzzy relevance
      return filteredDocs.length > 0
        ? [{ label: "RESULTS", docs: filteredDocs }]
        : [];
    }
    return groupByCategory(filteredDocs);
  }, [isRecsMode, recsFilter, filteredDocs]);

  // Flat list of visible docs (for index-based navigation)
  const flatList = useMemo(
    () => groups.flatMap((g) => g.docs),
    [groups],
  );

  const selected = flatList[selectedIndex];

  // Doc preview lines for the selected operation
  const docLines = useMemo(
    () => (selected ? formatPreviewLines(selected) : []),
    [selected],
  );

  // Reset doc scroll when selection changes
  const prevSelectedRef = useRef(selected);
  if (prevSelectedRef.current !== selected) {
    prevSelectedRef.current = selected;
    // Can't call setDocScroll during render in strict mode, but this is Ink
    // which doesn't use strict mode. For safety, we clamp in the render below.
    setDocScroll(0);
  }

  const docScrollClamped = Math.min(docScroll, Math.max(0, docLines.length - docViewport));
  const visibleDocLines = docLines.slice(docScrollClamped, docScrollClamped + docViewport);
  const hasDocScrollUp = docScrollClamped > 0;
  const hasDocScrollDown = docScrollClamped + docViewport < docLines.length;

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
  // VimTextInput handles Escape/Enter when operations is focused,
  // so Escape only fires for non-operations focus areas.
  useInput((_input, key) => {
    // In zoom mode, let the secondary handler take over entirely
    if (zoomedIndex !== null) return;

    if (key.escape && focusArea !== "operations") {
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
        setDocScroll(0);
        return;
      }
      if (key.downArrow) {
        setSelectedIndex((i) => Math.min(flatList.length - 1, i + 1));
        setDocScroll(0);
        return;
      }
      if (key.return) {
        if (isRecsMode && selected) {
          // Check for extra words after the operation name (inline args)
          const afterOp = recsFilter.slice(selected.name.length).trim();
          if (afterOp) {
            onSelect(selected.name, afterOp.split(/\s+/));
          } else {
            onSelect(selected.name);
          }
        } else if (!isRecsMode && shellCommand) {
          // Shell command mode
          const args = shellParts.slice(1);
          onSelect(shellCommand, args.length > 0 ? args : undefined);
        }
        return;
      }
    }

    // Ctrl+D / Ctrl+U scroll the doc preview by half a page
    // Gate Ctrl+U behind focusArea !== "operations" to avoid conflict with
    // VimTextInput's Ctrl+U (clear line) when the search box is focused.
    const halfPage = Math.max(1, Math.floor(docViewport / 2));
    if (_input === "d" && key.ctrl) {
      setDocScroll((s) => Math.min(Math.max(0, docLines.length - docViewport), s + halfPage));
      return;
    }
    if (_input === "u" && key.ctrl && focusArea !== "operations") {
      setDocScroll((s) => Math.max(0, s - halfPage));
      return;
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
    const viewportHeight = 15;
    let scrollTop = Math.max(0, zoomCursorRow - Math.floor(viewportHeight / 2));
    if (scrollTop + viewportHeight > zoomRows.length) {
      scrollTop = Math.max(0, zoomRows.length - viewportHeight);
    }
    const visibleRows = zoomRows.slice(scrollTop, scrollTop + viewportHeight);

    return (
      <Box
        flexDirection="column"
        width="90%"
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

  // Build a flat list of entries (category headers + docs) for the scrolling viewport
  const listEntries = useMemo(() => {
    const entries: Array<{ kind: "header"; label: string } | { kind: "doc"; doc: CommandDoc; flatIdx: number }> = [];
    let flatIdx = 0;
    for (const group of groups) {
      entries.push({ kind: "header", label: group.label });
      for (const doc of group.docs) {
        entries.push({ kind: "doc", doc, flatIdx });
        flatIdx++;
      }
    }
    return entries;
  }, [groups]);

  // Find the entry index corresponding to the selected flatList index
  const selectedEntryIdx = useMemo(() => {
    for (let i = 0; i < listEntries.length; i++) {
      const e = listEntries[i]!;
      if (e.kind === "doc" && e.flatIdx === selectedIndex) return i;
    }
    return 0;
  }, [listEntries, selectedIndex]);

  // Compute viewport scroll position to keep selected item visible
  const listScrollTop = useMemo(() => {
    const total = listEntries.length;
    if (total <= opViewport) return 0;
    // Center the selected item in the viewport
    let top = selectedEntryIdx - Math.floor(opViewport / 2);
    top = Math.max(0, Math.min(top, total - opViewport));
    return top;
  }, [listEntries, selectedEntryIdx]);

  const visibleEntries = listEntries.slice(listScrollTop, listScrollTop + opViewport);
  const hasScrollUp = listScrollTop > 0;
  const hasScrollDown = listScrollTop + opViewport < listEntries.length;

  return (
    <Box
      flexDirection="column"
      width="90%"
      flexGrow={1}
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      {/* Title bar */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.peach} bold>{titleText}</Text>
        <Text>
          <Text color={theme.lavender}>[Esc(2x)]</Text>
          <Text color={theme.subtext0}> cancel</Text>
          {hasRecords && (
            <>
              <Text color={theme.subtext0}>  </Text>
              <Text color={theme.lavender}>[Tab]</Text>
              <Text color={theme.subtext0}> stream</Text>
            </>
          )}
        </Text>
      </Box>

      {/* Command input */}
      <Box marginTop={1}>
        <Text color={theme.green}>$ </Text>
        <VimTextInput
          value={query}
          onChange={(v) => {
            // Auto-transition: when the user types a space after a recognized
            // operation name, switch to EditStageModal for live preview.
            const isRecs = v.startsWith(RECS_PREFIX);
            if (isRecs) {
              const filter = v.slice(RECS_PREFIX.length);
              const spaceIdx = filter.indexOf(" ");
              if (spaceIdx > 0) {
                const firstWord = filter.slice(0, spaceIdx);
                const matched = allDocs.find(
                  (d) => d.name === firstWord && !HIDDEN_OPS.has(d.name),
                );
                if (matched) {
                  const afterOp = filter.slice(spaceIdx + 1).trim();
                  onSelect(matched.name, afterOp ? afterOp.split(/\s+/) : []);
                  return;
                }
              }
            } else {
              // Shell mode: transition after command name + space
              const trimmed = v.trim();
              if (trimmed && v.includes(" ")) {
                const parts = trimmed.split(/\s+/);
                const cmd = parts[0];
                if (cmd) {
                  onSelect(cmd, parts.slice(1));
                  return;
                }
              }
            }
            setQuery(v);
            setSelectedIndex(0);
          }}
          onEscape={onCancel}
          placeholder="recs grep ..."
          focus={focusArea === "operations"}
        />
      </Box>

      {/* Two-column content: operations + op preview (recs mode) */}
      {isRecsMode ? (
      <Box flexDirection="row" marginTop={1}>
        {/* Left: scrolling categorized list — fixed height to prevent layout jitter */}
        <Box width="40%" flexDirection="column" overflow="hidden" height={opViewport + 2}>
          <Text color={theme.overlay0}>{hasScrollUp ? "  ↑ more" : ""}</Text>
          {visibleEntries.map((entry, vi) => {
            if (entry.kind === "header") {
              const headerColor = entry.label === "TRANSFORM" ? theme.mauve
                : entry.label === "INPUT" ? theme.blue
                : entry.label === "OUTPUT" ? theme.green
                : theme.subtext0;
              return <Text key={`hdr-${entry.label}-${vi}`} color={headerColor} bold>{entry.label}</Text>;
            }
            const isSel = entry.flatIdx === selectedIndex && focusArea === "operations";
            return (
              <Text
                key={entry.doc.name}
                backgroundColor={isSel ? theme.surface0 : undefined}
                color={isSel ? theme.lavender : theme.subtext0}
                bold={isSel}
              >
                {isSel ? "> " : "  "}
                {entry.doc.name}
              </Text>
            );
          })}
          <Text color={theme.overlay0}>{hasScrollDown ? "  ↓ more" : ""}</Text>
          {flatList.length === 0 && (
            <Text color={theme.overlay0}>No matching operations</Text>
          )}
        </Box>

        {/* Right: scrolling doc preview pane */}
        <Box flexGrow={1} marginLeft={2} flexDirection="column" overflow="hidden" height={opViewport + 2}>
          {selected ? (
            <>
              {hasDocScrollUp && <Text color={theme.overlay0}>↑ Ctrl+U</Text>}
              {!hasDocScrollUp && <Text>{" "}</Text>}
              {visibleDocLines.map((line, i) => (
                <Text key={i} color={theme.text}>{line}</Text>
              ))}
              {hasDocScrollDown && <Text color={theme.overlay0}>↓ Ctrl+D</Text>}
            </>
          ) : (
            <Text color={theme.overlay0}>Select an operation to see details</Text>
          )}
        </Box>
      </Box>
      ) : (
      /* Shell command mode */
      <Box flexDirection="column" marginTop={1} height={opViewport + 2} overflow="hidden">
        <Text color={theme.subtext0} bold>SHELL COMMAND</Text>
        <Text color={theme.text}>{" "}</Text>
        {shellCommand ? (
          <>
            <Text color={theme.text}>  Command: <Text bold>{shellCommand}</Text></Text>
            {shellArgs ? (
              <Text color={theme.text}>  Args: {shellArgs}</Text>
            ) : (
              <Text color={theme.overlay0}>  (no args — add after Enter)</Text>
            )}
            <Text color={theme.text}>{" "}</Text>
            <Text color={theme.overlay0}>  Records will be serialized as JSONL, piped through the</Text>
            <Text color={theme.overlay0}>  command, and parsed back as records.</Text>
          </>
        ) : (
          <Text color={theme.overlay0}>  Type a command name (e.g., head, tail, jq, grep ...)</Text>
        )}
      </Box>
      )}

      {/* Stream preview — fixed height */}
      {hasRecords && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={focusArea === "preview" ? theme.blue : theme.surface1}
          paddingX={1}
          marginTop={1}
          height={previewMaxRecords + 4}
        >
          <Box height={1} flexDirection="row" justifyContent="space-between">
            <Text color={focusArea === "preview" ? theme.blue : theme.subtext0} bold>
              Stream Preview
            </Text>
            <Text color={theme.overlay0}>
              {records!.length} rec{records!.length > previewMaxRecords ? ` (showing ${previewMaxRecords})` : ""}
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
              {/* Record rows + padding */}
              {Array.from({ length: previewMaxRecords }, (_, ri) => {
                const record = previewRecords[ri];
                if (!record) {
                  return <Text key={ri}>{" "}</Text>;
                }
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
            ? isRecsMode
              ? "↑↓:navigate  Enter:select  Esc:vim  Esc(2x):cancel  ^D/^U:scroll docs"
              : "Enter:add command  Esc:vim  Esc(2x):cancel"
            : "↑↓:navigate  Enter:zoom record  Esc:cancel  Tab:operations"}
        </Text>
      </Box>
    </Box>
  );
}
