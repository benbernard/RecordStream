/**
 * EditStageModal — raw args text input for editing stage arguments,
 * plus side-by-side input/output preview panels.
 *
 * Layout:
 * - Top: title bar (operation name + hints)
 * - Middle: args text input
 * - Bottom: side-by-side input (upstream) / output (live preview) panels
 *
 * Tab cycles focus: args → input → output → args.
 * In input/output panels: ↑↓ navigate records, Enter zooms into a record detail.
 * Enter (in args) confirms the edit. Esc cancels (or exits zoom).
 */

import { useCallback, useState, useMemo, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { Record } from "../../../Record.ts";
import type { JsonValue } from "../../../types/json.ts";
import { allDocs } from "../../../cli/operation-registry.ts";
import type { CommandDoc } from "../../../types/CommandDoc.ts";
import { VimTextInput } from "../VimTextInput.tsx";
import { theme } from "../../theme.ts";
import { createOperationOrShell } from "../../../operations/transform/chain.ts";
import { InterceptReceiver } from "../../executor/intercept-receiver.ts";

export interface EditStageModalProps {
  /** The operation name being edited */
  operationName: string;
  /** Current args as a single string (space-separated) */
  currentArgs: string;
  /** Called when user confirms edit */
  onConfirm: (args: string[]) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Called when user types | — confirms current args and adds a stage after */
  onPipe?: (args: string[]) => void;
  /** Upstream records (output of the parent stage) */
  records?: Record[];
  /** Field names from the upstream cached result */
  fieldNames?: string[];
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

// ── Operation doc helpers ────────────────────────────────────────

function formatDocLines(doc: CommandDoc): string[] {
  const lines: string[] = [];
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
    lines.push("Examples:");
    for (const ex of doc.examples) {
      lines.push(`  ${ex.command}`);
      if (ex.description) {
        lines.push(`  # ${ex.description}`);
      }
    }
  }
  return lines;
}

// ── Shell preview safety ─────────────────────────────────────────

/** Shell commands that are safe to auto-preview (read-only / filtering). */
const SAFE_SHELL_COMMANDS = new Set([
  "head", "tail", "grep", "egrep", "fgrep",
  "awk", "gawk", "sed",
  "cut", "paste", "join", "column",
  "sort", "uniq", "shuf",
  "wc", "nl", "cat", "tac",
  "tr", "rev", "fold", "fmt",
  "jq", "yq", "gojq",
]);

// ── Focus areas ─────────────────────────────────────────────────

type FocusArea = "args" | "input" | "output";

const FOCUS_CYCLE: FocusArea[] = ["args", "input", "output"];

export function EditStageModal({
  operationName,
  currentArgs,
  onConfirm,
  onCancel,
  onPipe,
  records,
  fieldNames,
}: EditStageModalProps) {
  const [value, setValue] = useState(currentArgs);
  const [focusArea, setFocusArea] = useState<FocusArea>("args");
  const [inputCursor, setInputCursor] = useState(0);
  const [outputCursor, setOutputCursor] = useState(0);

  // Zoom state: which record index is zoomed (null = no zoom)
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const [zoomSource, setZoomSource] = useState<"input" | "output">("input");
  const [zoomCursorRow, setZoomCursorRow] = useState(0);
  const [zoomCollapsed, setZoomCollapsed] = useState<Set<string>>(() => new Set());

  // Output preview state
  const [outputRecords, setOutputRecords] = useState<Record[]>([]);
  const [outputFieldNames, setOutputFieldNames] = useState<string[]>([]);
  const [outputLines, setOutputLines] = useState<string[]>([]);
  const [outputError, setOutputError] = useState<string | null>(null);

  // Shell preview gating: recs ops and safe shell commands auto-preview;
  // unknown shell commands require explicit opt-in via Ctrl+E.
  const isRecsOp = useMemo(
    () => allDocs.some((d) => d.name === operationName),
    [operationName],
  );
  const [shellPreviewEnabled, setShellPreviewEnabled] = useState(false);
  const previewEnabled = isRecsOp || SAFE_SHELL_COMMANDS.has(operationName) || shellPreviewEnabled;

  // Doc help state
  const [docScroll, setDocScroll] = useState(0);
  const opDoc = useMemo(() => allDocs.find((d) => d.name === operationName), [operationName]);
  const docLines = useMemo(() => (opDoc ? formatDocLines(opDoc) : []), [opDoc]);

  const hasRecords = records && records.length > 0;
  const hasDoc = docLines.length > 0;

  // ── Dynamic height computation ────────────────────────────────
  // Distribute available terminal rows between the doc viewport and
  // the record preview panels so the modal fills the screen.
  const { stdout } = useStdout();
  const termRows = stdout?.rows ?? 40;

  // Fixed overhead lines that are always consumed:
  //   App chrome (TitleBar + ForkTabs + PipelineBar): 5
  //   Modal border(2) + padding(2): 4
  //   Title bar: 1, gap+cmd: 2, gap+args: 2, gap+footer: 2 → 7
  // Conditional overhead:
  //   Doc section: marginTop(1) + scroll indicators(2) = 3
  //   Panel section: marginTop(1) + border(2) + title(1) + header(1) = 5
  const fixedOverhead = 5 + 4 + 7
    + (hasDoc ? 3 : 0)
    + (hasRecords ? 5 : 0);
  const available = Math.max(0, termRows - fixedOverhead);

  let docViewport: number;
  let previewMaxRecords: number;
  if (!hasDoc && !hasRecords) {
    docViewport = 0;
    previewMaxRecords = 0;
  } else if (!hasRecords) {
    docViewport = Math.max(3, available);
    previewMaxRecords = 0;
  } else if (!hasDoc) {
    docViewport = 0;
    previewMaxRecords = Math.max(3, available);
  } else {
    // Split: 55% to doc, 45% to records
    docViewport = Math.max(3, Math.floor(available * 0.55));
    previewMaxRecords = Math.max(3, available - docViewport);
  }

  const previewRecords = useMemo(
    () => (records ?? []).slice(0, previewMaxRecords),
    [records, previewMaxRecords],
  );

  // Debounced args for output preview
  const [debouncedArgs, setDebouncedArgs] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedArgs(value), 300);
    return () => clearTimeout(timer);
  }, [value]);

  // Execute preview when debounced args change (gated by previewEnabled)
  useEffect(() => {
    if (!previewEnabled) {
      setOutputRecords([]);
      setOutputFieldNames([]);
      setOutputLines([]);
      setOutputError(null);
      return;
    }
    try {
      const parsed = parseArgs(debouncedArgs);
      const interceptor = new InterceptReceiver();
      const op = createOperationOrShell(operationName, parsed, interceptor);
      for (const record of previewRecords) {
        op.acceptRecord(record);
      }
      op.finish();
      setOutputRecords(interceptor.records.slice(0, previewMaxRecords));
      setOutputFieldNames([...interceptor.fieldNames]);
      setOutputLines(interceptor.lines.slice(0, previewMaxRecords));
      setOutputError(null);
    } catch (e: unknown) {
      setOutputRecords([]);
      setOutputFieldNames([]);
      setOutputLines([]);
      setOutputError(e instanceof Error ? e.message : String(e));
    }
  }, [debouncedArgs, operationName, previewRecords, previewEnabled]);

  const outputPreviewRecords = outputRecords;

  const handleSubmit = useCallback(
    (val: string) => {
      const args = parseArgs(val);
      onConfirm(args);
    },
    [onConfirm],
  );

  // Intercept | character: confirm current args and pipe to a new stage
  const handleArgsChange = useCallback(
    (newValue: string) => {
      if (newValue.includes("|")) {
        const clean = newValue.replace(/\|/g, "").trimEnd();
        if (onPipe) {
          onPipe(parseArgs(clean));
        }
        return;
      }
      setValue(newValue);
    },
    [onPipe],
  );

  // Determine which record set to use for zoom
  const zoomRecordSet = zoomSource === "input" ? previewRecords : outputPreviewRecords;
  const zoomedRecord = zoomedIndex !== null ? zoomRecordSet[zoomedIndex] : undefined;
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
  // VimTextInput handles Escape/Enter when args is focused,
  // so this handler only fires for non-args focus areas.
  useInput((_input, key) => {
    // In zoom mode, let the secondary handler take over entirely
    if (zoomedIndex !== null) return;

    if (key.escape && focusArea !== "args") {
      onCancel();
      return;
    }

    if (key.tab) {
      if (hasRecords) {
        setFocusArea((f) => {
          const idx = FOCUS_CYCLE.indexOf(f);
          return FOCUS_CYCLE[(idx + 1) % FOCUS_CYCLE.length]!;
        });
      }
      return;
    }

    // Ctrl+E toggles live preview for unsafe shell commands
    if (_input === "e" && key.ctrl && !isRecsOp) {
      setShellPreviewEnabled((prev) => !prev);
      return;
    }

    // Ctrl+D / Ctrl+U scroll the doc help by half a page
    // Gate Ctrl+U behind focusArea !== "args" to avoid conflict with VimTextInput's Ctrl+U
    const halfPage = Math.max(1, Math.floor(docViewport / 2));
    if (_input === "d" && key.ctrl) {
      setDocScroll((s) => Math.min(Math.max(0, docLines.length - docViewport), s + halfPage));
      return;
    }
    if (_input === "u" && key.ctrl && focusArea !== "args") {
      setDocScroll((s) => Math.max(0, s - halfPage));
      return;
    }
  });

  // ── Keyboard: zoom mode + preview navigation ─────────────────
  // Active only when TextInput is NOT focused (input/output/zoom).
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
        if (zoomedIndex < zoomRecordSet.length - 1) {
          setZoomedIndex((i) => i! + 1);
          setZoomCursorRow(0);
          setZoomCollapsed(new Set());
        }
        return;
      }
      return; // Absorb all other input while zoomed
    }

    // ── Input panel navigation ────────────────────────────────
    if (focusArea === "input") {
      if (key.upArrow || input === "k") {
        setInputCursor((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        setInputCursor((i) => Math.min(previewRecords.length - 1, i + 1));
        return;
      }
      if (key.return) {
        if (previewRecords.length > 0) {
          setZoomSource("input");
          setZoomedIndex(inputCursor);
          setZoomCursorRow(0);
          setZoomCollapsed(new Set());
        }
        return;
      }
    }

    // ── Output panel navigation ───────────────────────────────
    if (focusArea === "output") {
      if (key.upArrow || input === "k") {
        setOutputCursor((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow || input === "j") {
        setOutputCursor((i) => Math.min(outputPreviewRecords.length - 1, i + 1));
        return;
      }
      if (key.return) {
        if (outputPreviewRecords.length > 0) {
          setZoomSource("output");
          setZoomedIndex(outputCursor);
          setZoomCursorRow(0);
          setZoomCollapsed(new Set());
        }
        return;
      }
    }
  }, { isActive: focusArea !== "args" || zoomedIndex !== null });

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
        flexGrow={1}
        borderStyle="single"
        borderColor={theme.surface1}
        padding={1}
      >
        {/* Header */}
        <Box height={1} flexDirection="row" justifyContent="space-between">
          <Text color={theme.text}>
            <Text bold>Record #{zoomedIndex + 1}</Text>
            <Text color={theme.subtext0}> of {zoomRecordSet.length} ({zoomSource})</Text>
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

  // Compute input panel table data
  const inputFields = fieldNames ?? [];
  const inputColWidths = useMemo(
    () => computeColumnWidths(inputFields, previewRecords),
    [inputFields, previewRecords],
  );

  // Compute output panel table data
  const outputFields = outputFieldNames;
  const outputColWidths = useMemo(
    () => computeColumnWidths(outputFields, outputPreviewRecords),
    [outputFields, outputPreviewRecords],
  );

  // Panel height: border(2) + panel title(1) + column header(1) + data rows
  const panelHeight = previewMaxRecords + 4;

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
        <Text>
          <Text color={theme.blue}>Edit: </Text>
          <Text color={theme.peach} bold>{isRecsOp ? `recs ${operationName}` : operationName}</Text>
        </Text>
        <Text>
          <Text color={theme.lavender}>[Esc(2x)]</Text>
          <Text color={theme.subtext0}> cancel</Text>
          {hasRecords && (
            <>
              <Text color={theme.subtext0}>  </Text>
              <Text color={theme.lavender}>[Tab]</Text>
              <Text color={theme.subtext0}> switch panel</Text>
            </>
          )}
        </Text>
      </Box>

      {/* Current command preview */}
      <Box marginTop={1}>
        <Text>
          <Text color={theme.green}>$ </Text>
          <Text color={theme.subtext0}>{isRecsOp ? `recs ${operationName}` : operationName} </Text>
          {value ? <Text color={theme.text}>{value}</Text> : <Text color={theme.surface1}>(no args)</Text>}
        </Text>
      </Box>

      {/* Args input */}
      <Box marginTop={1}>
        <Text color={theme.blue}>Args: </Text>
        <VimTextInput
          value={value}
          onChange={handleArgsChange}
          onSubmit={handleSubmit}
          onEscape={onCancel}
          placeholder="--key value ..."
          focus={focusArea === "args"}
        />
      </Box>

      {/* Operation help */}
      {docLines.length > 0 && (() => {
        const scrollClamped = Math.min(docScroll, Math.max(0, docLines.length - docViewport));
        const visibleLines = docLines.slice(scrollClamped, scrollClamped + docViewport);
        const hasUp = scrollClamped > 0;
        const hasDown = scrollClamped + docViewport < docLines.length;
        return (
          <Box flexDirection="column" marginTop={1} height={docViewport + 2} overflow="hidden">
            {hasUp && <Text color={theme.overlay0}>↑ ^U</Text>}
            {!hasUp && <Text>{" "}</Text>}
            {visibleLines.map((line, i) => (
              <Text key={i} color={theme.subtext0}>{line}</Text>
            ))}
            {hasDown && <Text color={theme.overlay0}>↓ ^D</Text>}
          </Box>
        );
      })()}

      {/* Side-by-side input/output preview */}
      {hasRecords && (
        <Box flexDirection="row" marginTop={1} gap={1}>
          {/* Input panel */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={focusArea === "input" ? theme.blue : theme.surface1}
            paddingX={1}
            width="50%"
            height={panelHeight}
          >
            <Box height={1} flexDirection="row" justifyContent="space-between">
              <Text color={focusArea === "input" ? theme.blue : theme.subtext0} bold>
                Input
              </Text>
              <Text color={theme.overlay0}>
                {records!.length} rec{records!.length !== 1 ? "s" : ""}
              </Text>
            </Box>

            {inputFields.length > 0 ? (
              <Box flexDirection="column" overflow="hidden">
                {/* Header row */}
                <Text color={theme.overlay0}>
                  {"  #   "}
                  {inputFields.map((f, i) =>
                    f.padEnd(inputColWidths[i]!).slice(0, inputColWidths[i]!),
                  ).join("  ")}
                </Text>
                {/* Record rows + padding */}
                {Array.from({ length: previewMaxRecords }, (_, ri) => {
                  const record = previewRecords[ri];
                  if (!record) {
                    return <Text key={ri}>{" "}</Text>;
                  }
                  const isSel = ri === inputCursor && focusArea === "input";
                  const prefix = isSel ? "> " : "  ";
                  const rowNum = String(ri + 1).padStart(3);
                  const cells = inputFields.map((field, fi) => {
                    const val = record.get(field);
                    const str = val === null || val === undefined ? "" : String(val);
                    return str.padEnd(inputColWidths[fi]!).slice(0, inputColWidths[fi]!);
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

          {/* Output panel */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={
              focusArea === "output"
                ? (outputError ? theme.red : theme.green)
                : (outputError ? theme.red : theme.surface1)
            }
            paddingX={1}
            width="50%"
            height={panelHeight}
          >
            <Box height={1} flexDirection="row" justifyContent="space-between">
              <Text color={focusArea === "output" ? theme.green : theme.subtext0} bold>
                Output
              </Text>
              <Text color={theme.overlay0}>
                {outputError
                  ? "error"
                  : outputPreviewRecords.length > 0
                    ? `${outputPreviewRecords.length} rec${outputPreviewRecords.length !== 1 ? "s" : ""}`
                    : outputLines.length > 0
                      ? `${outputLines.length} line${outputLines.length !== 1 ? "s" : ""}`
                      : "empty"}
              </Text>
            </Box>

            {!previewEnabled ? (
              <Box flexDirection="column" overflow="hidden">
                <Text color={theme.yellow}>Shell preview paused</Text>
                <Text color={theme.overlay0}>^E to enable live preview</Text>
                {Array.from({ length: Math.max(0, previewMaxRecords - 2) }, (_, i) => (
                  <Text key={i}>{" "}</Text>
                ))}
              </Box>
            ) : outputError ? (
              <Box flexDirection="column" overflow="hidden">
                <Text color={theme.red} wrap="truncate">{outputError}</Text>
                {Array.from({ length: previewMaxRecords - 1 }, (_, i) => (
                  <Text key={i}>{" "}</Text>
                ))}
              </Box>
            ) : outputFields.length > 0 ? (
              <Box flexDirection="column" overflow="hidden">
                {/* Header row */}
                <Text color={theme.overlay0}>
                  {"  #   "}
                  {outputFields.map((f, i) =>
                    f.padEnd(outputColWidths[i]!).slice(0, outputColWidths[i]!),
                  ).join("  ")}
                </Text>
                {/* Record rows + padding */}
                {Array.from({ length: previewMaxRecords }, (_, ri) => {
                  const record = outputPreviewRecords[ri];
                  if (!record) {
                    return <Text key={ri}>{" "}</Text>;
                  }
                  const isSel = ri === outputCursor && focusArea === "output";
                  const prefix = isSel ? "> " : "  ";
                  const rowNum = String(ri + 1).padStart(3);
                  const cells = outputFields.map((field, fi) => {
                    const val = record.get(field);
                    const str = val === null || val === undefined ? "" : String(val);
                    return str.padEnd(outputColWidths[fi]!).slice(0, outputColWidths[fi]!);
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
            ) : outputLines.length > 0 ? (
              <Box flexDirection="column" overflow="hidden">
                {/* Text line output (tojson, tocsv, toprettyprint, etc.) */}
                {Array.from({ length: previewMaxRecords }, (_, li) => {
                  const line = outputLines[li];
                  if (line === undefined) {
                    return <Text key={li}>{" "}</Text>;
                  }
                  const isSel = li === outputCursor && focusArea === "output";
                  return (
                    <Text
                      key={li}
                      backgroundColor={isSel ? theme.surface0 : undefined}
                      color={isSel ? theme.text : theme.subtext0}
                      wrap="truncate"
                    >
                      {isSel ? "> " : "  "}{line}
                    </Text>
                  );
                })}
              </Box>
            ) : (
              <Box flexDirection="column" overflow="hidden">
                <Text color={theme.overlay0}>(no output)</Text>
                {Array.from({ length: previewMaxRecords - 1 }, (_, i) => (
                  <Text key={i}>{" "}</Text>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Footer hint */}
      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>
          {focusArea === "args"
            ? `Enter:confirm  Esc:vim  Esc(2x):cancel${hasRecords ? "  Tab:input" : ""}${!isRecsOp ? `  ^E:${previewEnabled ? "pause" : "run"} preview` : ""}`
            : focusArea === "input"
              ? `↑↓:navigate  Enter:zoom  Tab:output  Esc:cancel${!isRecsOp ? `  ^E:${previewEnabled ? "pause" : "run"} preview` : ""}`
              : `↑↓:navigate  Enter:zoom  Tab:args  Esc:cancel${!isRecsOp ? `  ^E:${previewEnabled ? "pause" : "run"} preview` : ""}`}
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
