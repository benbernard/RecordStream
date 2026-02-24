/**
 * HelpPanel — full keyboard reference overlay.
 *
 * Displayed when the user presses `?`. Shows all keyboard shortcuts
 * organized by context (global, pipeline, inspector).
 */

import { Box, Text, useInput } from "ink";
import { theme } from "../../theme.ts";

export interface HelpPanelProps {
  onClose: () => void;
}

interface HelpEntry {
  key: string;
  desc: string;
}

interface HelpSection {
  title: string;
  color: string;
  entries: HelpEntry[];
}

const HELP_SECTIONS: HelpSection[] = [
  {
    title: "PIPELINE",
    color: theme.mauve,
    entries: [
      { key: "↑/k ↓/j", desc: "Move cursor between stages" },
      { key: "a", desc: "Add stage after cursor" },
      { key: "A", desc: "Add stage before cursor" },
      { key: "d", desc: "Delete stage (with confirm)" },
      { key: "e", desc: "Edit stage arguments" },
      { key: "Space", desc: "Toggle stage enabled/disabled" },
      { key: "J/K", desc: "Reorder stage down/up" },
      { key: "r", desc: "Re-run from cursor stage" },
      { key: "Enter/Tab", desc: "Focus inspector panel" },
    ],
  },
  {
    title: "INSPECTOR",
    color: theme.blue,
    entries: [
      { key: "↑/k ↓/j", desc: "Scroll records" },
      { key: "t", desc: "Cycle view: table → pp → json → schema" },
      { key: "←/h →/l", desc: "Move column highlight (table view)" },
      { key: "Enter", desc: "Open record detail (tree view)" },
      { key: "Esc", desc: "Clear column highlight / return to pipeline" },
      { key: "g", desc: "Add grep stage (column highlighted)" },
      { key: "s", desc: "Add sort stage (column highlighted)" },
      { key: "c", desc: "Add collate stage (column highlighted)" },
      { key: "F", desc: "Open field spotlight (column highlighted)" },
    ],
  },
  {
    title: "GLOBAL",
    color: theme.peach,
    entries: [
      { key: "Tab", desc: "Toggle focus: pipeline ↔ inspector" },
      { key: "u", desc: "Undo last pipeline edit" },
      { key: "Ctrl+R", desc: "Redo last undone edit" },
      { key: "v", desc: "Open records in $EDITOR" },
      { key: "x", desc: "Export pipeline → clipboard" },
      { key: "X", desc: "Export pipeline (choose format)" },
      { key: "S", desc: "Save/rename session" },
      { key: "f", desc: "Fork at cursor stage" },
      { key: "b", desc: "Switch/manage forks" },
      { key: "i", desc: "Switch input source" },
      { key: "p", desc: "Pin/unpin stage cache" },
      { key: "?", desc: "Toggle this help" },
      { key: "q/Ctrl+C", desc: "Quit" },
    ],
  },
];

export function HelpPanel({ onClose }: HelpPanelProps) {
  useInput((input, key) => {
    if (key.escape || input === "?" || input === "q") {
      onClose();
    }
  });

  return (
    <Box
      flexDirection="column"
      width="70%"
      height="80%"
      borderStyle="single"
      borderColor={theme.mauve}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.mauve} bold>Keyboard Reference</Text>
        <Text>
          <Text color={theme.lavender}>[Esc]</Text>
          <Text color={theme.overlay0}> or </Text>
          <Text color={theme.lavender}>[?]</Text>
          <Text color={theme.overlay0}> to close</Text>
        </Text>
      </Box>

      <Box flexGrow={1} marginTop={1} flexDirection="column" overflow="hidden">
        {HELP_SECTIONS.map((section) => (
          <Box key={section.title} flexDirection="column" marginBottom={1}>
            <Text color={section.color} bold>{section.title}</Text>
            {section.entries.map((entry) => (
              <Text key={entry.key}>
                <Text color={theme.lavender}>  {entry.key.padEnd(12)}</Text>
                <Text color={theme.subtext0}>{entry.desc}</Text>
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
