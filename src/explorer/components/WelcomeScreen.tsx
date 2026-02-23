/**
 * WelcomeScreen — shown when `recs explorer` is launched with no arguments.
 *
 * Displays:
 * - Recent sessions list (navigable)
 * - File opener (path input)
 * - New empty pipeline option
 *
 * Keyboard:
 * - [o]     Open a file by path
 * - [Enter] Resume selected session
 * - [n]     Start a new empty pipeline
 * - [q]     Quit
 */

import { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { theme } from "../theme.ts";

export interface SessionSummary {
  sessionId: string;
  name?: string;
  inputLabel: string;
  stageCount: number;
  lastAccessedAt: number;
}

export interface WelcomeScreenProps {
  /** Recent sessions to display */
  sessions: SessionSummary[];
  /** Called when user selects a session to resume */
  onResumeSession: (sessionId: string) => void;
  /** Called when user opens a file */
  onOpenFile: (filePath: string) => void;
  /** Called when user starts a new empty pipeline */
  onNewPipeline: () => void;
  /** @deprecated Kept for App.tsx compat during migration; uses useApp().exit() internally */
  renderer?: unknown;
}

type Mode = "list" | "fileInput";

function formatTimeAgo(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function WelcomeScreen({
  sessions,
  onResumeSession,
  onOpenFile,
  onNewPipeline,
}: WelcomeScreenProps) {
  const { exit } = useApp();
  const [mode, setMode] = useState<Mode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filePath, setFilePath] = useState("");

  const handleFileSubmit = useCallback(() => {
    const trimmed = filePath.trim();
    if (trimmed.length > 0) {
      onOpenFile(trimmed);
    }
  }, [filePath, onOpenFile]);

  useInput((input, key) => {
    if (mode === "fileInput") {
      if (key.escape) {
        setMode("list");
        return;
      }
      if (key.return) {
        handleFileSubmit();
        return;
      }
      // Handle text input for file path
      if (key.backspace || key.delete) {
        setFilePath((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setFilePath((prev) => prev + input);
      }
      return;
    }

    // List mode
    // Handle special keys first (these are unaffected by PTY batching
    // because escape sequences and control chars are split by the parser)
    if (input === "c" && key.ctrl) {
      exit();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(sessions.length - 1, i + 1));
      return;
    }
    if (key.return) {
      if (sessions.length > 0 && sessions[selectedIndex]) {
        onResumeSession(sessions[selectedIndex]!.sessionId);
      }
      return;
    }

    // Process printable characters individually.
    // When the terminal event loop is busy, multiple keystrokes can arrive
    // batched in a single DATA event (e.g. "nn" instead of two separate "n"
    // events). Iterating over each character ensures single-key commands
    // still match.
    for (const ch of input) {
      if (ch === "q") { exit(); return; }
      if (ch === "o") { setMode("fileInput"); return; }
      if (ch === "n") { onNewPipeline(); return; }
      if (ch === "k") { setSelectedIndex((i) => Math.max(0, i - 1)); return; }
      if (ch === "j") { setSelectedIndex((i) => Math.min(sessions.length - 1, i + 1)); return; }
    }
  });

  return (
    <Box flexDirection="column" width="100%" height="100%" justifyContent="center" alignItems="center">
      <Box flexDirection="column" width={60}>
        <Text bold color={theme.text}>
          Welcome to recs explorer
        </Text>
        <Text> </Text>
        <Text color={theme.text}>Open a file to start building a pipeline:</Text>
        <Text> </Text>

        {/* Recent sessions */}
        {sessions.length > 0 ? (
          <Box flexDirection="column">
            <Text color={theme.overlay0}>Recent sessions:</Text>
            {sessions.map((session, idx) => {
              const isSelected = idx === selectedIndex && mode === "list";
              const stageLabel = session.stageCount === 1 ? "1 stage" : `${session.stageCount} stages`;
              const timeLabel = formatTimeAgo(session.lastAccessedAt);
              const primaryLabel = session.name ?? session.inputLabel;
              const secondaryLabel = session.name ? ` (${session.inputLabel})` : "";
              return (
                <Text
                  key={session.sessionId}
                  backgroundColor={isSelected ? theme.surface0 : undefined}
                  color={isSelected ? theme.text : theme.subtext0}
                >
                  {isSelected ? "> " : "  "}
                  {primaryLabel}{secondaryLabel} — {stageLabel}, last used {timeLabel}
                </Text>
              );
            })}
          </Box>
        ) : (
          <Text color={theme.surface1}>No recent sessions</Text>
        )}

        <Text> </Text>

        {/* File input mode */}
        {mode === "fileInput" ? (
          <Box flexDirection="column">
            <Box>
              <Text color={theme.text}>File path: </Text>
              <Text color={theme.lavender}>{filePath}<Text color={theme.overlay0}>|</Text></Text>
            </Box>
            <Box height={1} marginTop={1}>
              <Text color={theme.overlay0}>Enter:open  Esc:back</Text>
            </Box>
          </Box>
        ) : (
          <Text color={theme.subtext0}>
            [o] Open file    [Enter] Resume session    [n] New empty pipeline    [q] Quit
          </Text>
        )}
      </Box>
    </Box>
  );
}
