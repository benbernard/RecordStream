/**
 * HelpPanel — full keyboard reference overlay.
 *
 * Displayed when the user presses `?`. Shows all keyboard shortcuts
 * organized by context (global, pipeline, inspector).
 */

import { useKeyboard } from "@opentui/react";

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
  Enter/Tab    Focus inspector panel

INSPECTOR (right panel)
  ↑/k, ↓/j    Scroll records
  PgUp/PgDn    Page scroll
  t            Cycle view: table → prettyprint → json → schema
  /            Search records
  Esc/Tab      Return to pipeline

GLOBAL
  Tab          Toggle focus: pipeline ↔ inspector
  f            Fork at cursor
  b            Switch fork branch
  i            Switch input file
  r            Re-run from first stale stage
  v            Open records in $EDITOR
  x            Export pipeline (shell pipe script → clipboard)
  X            Export pipeline (choose format)
  u            Undo last pipeline edit
  Ctrl+R       Redo last undone edit
  p            Pin/unpin stage for selective caching
  ?            Toggle this help
  q            Quit (auto-saves session)`;

export function HelpPanel({ onClose }: HelpPanelProps) {
  useKeyboard((key) => {
    if (key.name === "escape" || key.raw === "?" || key.raw === "q") {
      onClose();
    }
  });

  return (
    <box
      flexDirection="column"
      width="70%"
      height="80%"
      borderStyle="single"
      padding={1}
    >
      <box height={1} flexDirection="row" justifyContent="space-between">
        <text>
          <b>Help</b>
        </text>
        <text fg="#666666">[Esc] or [?] to close</text>
      </box>

      <scrollbox flexGrow={1} marginTop={1}>
        <text>{HELP_TEXT}</text>
      </scrollbox>
    </box>
  );
}
