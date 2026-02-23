/**
 * AddStageModal — categorized operation picker with fuzzy search + preview.
 *
 * Two-column layout:
 * - Left: search input + categorized operation list (Transform, Input, Output)
 * - Right: preview pane showing description, options, and examples
 *
 * Enter selects the operation. Esc cancels.
 */

import { useState, useMemo } from "react";
import { useKeyboard } from "@opentui/react";
import { allDocs } from "../../../cli/operation-registry.ts";
import type { CommandDoc } from "../../../types/CommandDoc.ts";
import { fuzzyFilter } from "../../utils/fuzzy-match.ts";

export interface AddStageModalProps {
  /** Called when user selects an operation */
  onSelect: (operationName: string) => void;
  /** Called when user cancels (Esc) */
  onCancel: () => void;
  /** Label shown in title (e.g., "after: grep") */
  afterLabel?: string;
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

export function AddStageModal({
  onSelect,
  onCancel,
  afterLabel,
}: AddStageModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusSearch, setFocusSearch] = useState(true);

  // Filter docs by fuzzy search, then group by category
  const filteredDocs = useMemo(
    () =>
      fuzzyFilter(
        allDocs.filter((d) => !HIDDEN_OPS.has(d.name)),
        query,
        (d) => `${d.name} ${d.description}`,
      ),
    [query],
  );

  const groups = useMemo(() => groupByCategory(filteredDocs), [filteredDocs]);

  // Flat list of visible docs (for index-based navigation)
  const flatList = useMemo(
    () => groups.flatMap((g) => g.docs),
    [groups],
  );

  const selected = flatList[selectedIndex];

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
      return;
    }

    if (key.name === "tab") {
      setFocusSearch((f) => !f);
      return;
    }

    if (!focusSearch) {
      if (key.name === "up" || key.raw === "k") {
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (key.name === "down" || key.raw === "j") {
        setSelectedIndex((i) => Math.min(flatList.length - 1, i + 1));
      } else if (key.name === "return") {
        if (selected) {
          onSelect(selected.name);
        }
      }
    }
  });

  const titleText = afterLabel
    ? `Add Stage (after: ${afterLabel})`
    : "Add Stage";

  return (
    <box
      flexDirection="column"
      width="80%"
      height="80%"
      borderStyle="single"
      padding={1}
    >
      {/* Title bar */}
      <box height={1} flexDirection="row" justifyContent="space-between">
        <text>{titleText}</text>
        <text fg="#666666">[Esc] cancel</text>
      </box>

      {/* Search input */}
      <box height={1} marginTop={1}>
        <text>Search: </text>
        <input
          value={query}
          onChange={(v) => {
            setQuery(v);
            setSelectedIndex(0);
          }}
          placeholder="type to filter..."
          focused={focusSearch}
          width={30}
        />
      </box>

      {/* Two-column content */}
      <box flexDirection="row" flexGrow={1} marginTop={1}>
        {/* Left: categorized list */}
        <scrollbox width="50%" flexDirection="column">
          {groups.map((group) => (
            <box key={group.label} flexDirection="column">
              <text fg="#888888">
                <b>{group.label}</b>
              </text>
              {group.docs.map((doc) => {
                const idx = flatList.indexOf(doc);
                const isSelected = idx === selectedIndex;
                return (
                  <text
                    key={doc.name}
                    bg={isSelected ? "#333333" : undefined}
                    fg={isSelected ? "#FFFFFF" : undefined}
                  >
                    {isSelected ? "> " : "  "}
                    {doc.name}
                  </text>
                );
              })}
            </box>
          ))}
          {flatList.length === 0 && (
            <text fg="#666666">No matching operations</text>
          )}
        </scrollbox>

        {/* Right: preview pane */}
        <scrollbox flexGrow={1} marginLeft={2} flexDirection="column">
          {selected ? (
            <text>{formatPreview(selected)}</text>
          ) : (
            <text fg="#666666">Select an operation to see details</text>
          )}
        </scrollbox>
      </box>

      {/* Footer hint */}
      <box height={1} marginTop={1}>
        <text fg="#666666">
          Tab:switch focus  ↑↓:navigate  Enter:select  Esc:cancel
        </text>
      </box>
    </box>
  );
}
