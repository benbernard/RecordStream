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

const HELP_TEXT = `Keyboard Reference

PIPELINE (left panel)
  ↑/k, ↓/j    Move cursor between stages
  a            Add stage after cursor
  A            Add stage before cursor
  d            Delete stage (with confirm)
  e            Edit stage arguments
  Space        Toggle stage enabled/disabled
  J/K          Reorder stage down/up
  r            Re-run from cursor stage
  Enter/Tab    Focus inspector panel

INSPECTOR (right panel)
  ↑/k, ↓/j    Scroll records
  t            Cycle view: table → prettyprint → json → schema
  ←/h, →/l    Move column highlight (table view)
  Enter        Open record detail (tree view)
  Esc          Clear column highlight / return to pipeline

  QUICK ACTIONS (when column highlighted in table view)
  g            Add grep stage for highlighted field
  s            Add sort stage for highlighted field
  c            Add collate stage for highlighted field
  F            Open field spotlight (value distribution)

GLOBAL
  Tab          Toggle focus: pipeline ↔ inspector
  u            Undo last pipeline edit
  Ctrl+R       Redo last undone edit
  v            Open records in $EDITOR
  x            Export pipeline → clipboard
  X            Export pipeline (choose format)
  S            Save/rename session
  f            Fork at cursor stage
  b            Switch/manage forks
  i            Switch input source
  p            Pin/unpin stage cache
  ?            Toggle this help
  q / Ctrl+C   Quit`;

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
      borderColor={theme.surface1}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text} bold>Help</Text>
        <Text color={theme.overlay0}>[Esc] or [?] to close</Text>
      </Box>

      <Box flexGrow={1} marginTop={1} flexDirection="column" overflow="hidden">
        <Text color={theme.text}>{HELP_TEXT}</Text>
      </Box>
    </Box>
  );
}
