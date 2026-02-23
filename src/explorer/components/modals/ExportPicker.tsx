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
import { Box, Text, useInput } from "ink";
import { theme } from "../../theme.ts";

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

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1));
    } else if (key.return) {
      const option = OPTIONS[selectedIndex];
      if (option) {
        onSelect(option.format);
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      width={50}
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text} bold>Export Pipeline</Text>
        <Text color={theme.overlay0}>[Esc] cancel</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {OPTIONS.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <Box key={opt.format} flexDirection="column">
              <Text
                backgroundColor={isSelected ? theme.surface0 : undefined}
                color={isSelected ? theme.text : theme.subtext0}
              >
                {isSelected ? "> " : "  "}
                {opt.label}
              </Text>
              <Text color={theme.overlay0}>    {opt.description}</Text>
            </Box>
          );
        })}
      </Box>

      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>↑↓:navigate  Enter:select  Esc:cancel</Text>
      </Box>
    </Box>
  );
}
