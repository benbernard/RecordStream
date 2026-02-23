/**
 * ExportPicker — format picker for exporting the pipeline.
 *
 * Options:
 * - Pipe script (multi-line shell script with | piping)
 * - Chain command (single-line recs chain format)
 * - Save to file (writes pipe script to a file)
 *
 * The selected format is copied to clipboard or written to file.
 */

import { useState } from "react";
import { useKeyboard } from "@opentui/react";

export type ExportFormat = "pipe-script" | "chain-command" | "save-file";

export interface ExportPickerProps {
  onSelect: (format: ExportFormat) => void;
  onCancel: () => void;
}

const OPTIONS: { format: ExportFormat; label: string; description: string }[] = [
  {
    format: "pipe-script",
    label: "Pipe script",
    description: "Multi-line shell script with | piping (copied to clipboard)",
  },
  {
    format: "chain-command",
    label: "Chain command",
    description: "Single-line recs chain command (copied to clipboard)",
  },
  {
    format: "save-file",
    label: "Save to file",
    description: "Write executable pipe script to a file",
  },
];

export function ExportPicker({ onSelect, onCancel }: ExportPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
      return;
    }

    if (key.name === "up" || key.raw === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.name === "down" || key.raw === "j") {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1));
    } else if (key.name === "return") {
      const option = OPTIONS[selectedIndex];
      if (option) {
        onSelect(option.format);
      }
    }
  });

  return (
    <box
      flexDirection="column"
      width={50}
      borderStyle="single"
      padding={1}
    >
      <box height={1} flexDirection="row" justifyContent="space-between">
        <text>
          <b>Export Pipeline</b>
        </text>
        <text fg="#666666">[Esc] cancel</text>
      </box>

      <box flexDirection="column" marginTop={1}>
        {OPTIONS.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <box key={opt.format} flexDirection="column">
              <text
                bg={isSelected ? "#333333" : undefined}
                fg={isSelected ? "#FFFFFF" : undefined}
              >
                {isSelected ? "> " : "  "}
                {opt.label}
              </text>
              <text fg="#888888">    {opt.description}</text>
            </box>
          );
        })}
      </box>

      <box height={1} marginTop={1}>
        <text fg="#666666">↑↓:navigate  Enter:select  Esc:cancel</text>
      </box>
    </box>
  );
}
