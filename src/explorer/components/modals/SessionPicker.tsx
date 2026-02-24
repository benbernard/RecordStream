/**
 * SessionPicker — resume session modal shown on launch.
 *
 * Displayed when an input file matches an existing session, offering
 * the user the choice to resume or start fresh.
 *
 * Keyboard: ↑↓ navigate, Enter select, Esc cancel (start fresh).
 */

import { useState } from "react";
import { Box, Text, useInput } from "ink";
import { theme } from "../../theme.ts";

export interface SessionMatch {
  sessionId: string;
  name?: string;
  inputLabel: string;
  stageCount: number;
  lastAccessedAt: number;
}

export interface SessionPickerProps {
  /** The file path that matched */
  filePath: string;
  /** Matching sessions for this file */
  sessions: SessionMatch[];
  /** Called when user selects a session to resume */
  onResume: (sessionId: string) => void;
  /** Called when user chooses to start fresh */
  onStartFresh: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function SessionPicker({
  filePath,
  sessions,
  onResume,
  onStartFresh,
}: SessionPickerProps) {
  // Options: each session + "Start fresh" at the end
  const totalOptions = sessions.length + 1;
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onStartFresh();
      return;
    }
    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(totalOptions - 1, i + 1));
    } else if (key.return) {
      if (selectedIndex < sessions.length) {
        const session = sessions[selectedIndex];
        if (session) {
          onResume(session.sessionId);
        }
      } else {
        onStartFresh();
      }
    }
  });

  const fileName = filePath.split("/").pop() ?? filePath;

  return (
    <Box
      flexDirection="column"
      width={60}
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text} bold>Resume Session?</Text>
        <Text color={theme.overlay0}>[Esc] start fresh</Text>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.subtext0}>
          Found existing sessions for {fileName}:
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {sessions.map((session, idx) => {
          const isSelected = idx === selectedIndex;
          const stageLabel = session.stageCount === 1 ? "1 stage" : `${session.stageCount} stages`;
          const timeLabel = formatTimeAgo(session.lastAccessedAt);
          const primaryLabel = session.name ?? session.inputLabel;
          const secondaryLabel = session.name ? ` (${session.inputLabel})` : "";
          return (
            <Box key={session.sessionId} flexDirection="column">
              <Text
                backgroundColor={isSelected ? theme.surface0 : undefined}
                color={isSelected ? theme.text : theme.subtext0}
              >
                {isSelected ? "> " : "  "}
                {primaryLabel}{secondaryLabel} — {stageLabel}, last used {timeLabel}
              </Text>
            </Box>
          );
        })}

        {/* Start fresh option */}
        <Text
          backgroundColor={selectedIndex === sessions.length ? theme.surface0 : undefined}
          color={selectedIndex === sessions.length ? theme.text : theme.subtext0}
        >
          {selectedIndex === sessions.length ? "> " : "  "}
          Start fresh (new pipeline)
        </Text>
      </Box>

      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>↑↓:navigate  Enter:select  Esc:start fresh</Text>
      </Box>
    </Box>
  );
}
