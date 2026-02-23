/**
 * SaveSessionModal — prompts for a session name.
 *
 * If the session is already named, offers rename or save-as-new.
 * If unnamed, prompts for a name and saves.
 *
 * Keyboard: Enter to confirm, Esc to cancel.
 */

import { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { theme } from "../../theme.ts";

export interface SaveSessionModalProps {
  /** Current session name, if any */
  currentName?: string;
  /** Called when user confirms the save with a name and mode */
  onConfirm: (name: string, mode: "rename" | "save-as") => void;
  /** Called when user cancels */
  onCancel: () => void;
}

type SaveMode = "rename" | "save-as";

export function SaveSessionModal({
  currentName,
  onConfirm,
  onCancel,
}: SaveSessionModalProps) {
  const hasName = Boolean(currentName);
  const [name, setName] = useState(currentName ?? "");
  const [mode, setMode] = useState<SaveMode>(hasName ? "rename" : "save-as");
  const [phase, setPhase] = useState<"choose" | "input">(
    hasName ? "choose" : "input",
  );

  const handleNameSubmit = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        onConfirm(trimmed, mode);
      }
    },
    [onConfirm, mode],
  );

  // Choose phase keyboard
  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow || input === "k") {
      setMode("rename");
    } else if (key.downArrow || input === "j") {
      setMode("save-as");
    } else if (key.return) {
      if (mode === "rename") {
        setName(currentName ?? "");
      } else {
        setName("");
      }
      setPhase("input");
    }
  }, { isActive: phase === "choose" });

  // Input phase keyboard — only Escape (TextInput handles chars + Enter via onSubmit)
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  }, { isActive: phase === "input" });

  return (
    <Box
      flexDirection="column"
      width={50}
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text} bold>Save Session</Text>
        <Text color={theme.overlay0}>[Esc] cancel</Text>
      </Box>

      {phase === "choose" ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.subtext0}>
            Current name: {currentName}
          </Text>
          <Box flexDirection="column" marginTop={1}>
            <Text
              backgroundColor={mode === "rename" ? theme.surface0 : undefined}
              color={mode === "rename" ? theme.text : theme.subtext0}
            >
              {mode === "rename" ? "> " : "  "}
              Rename session
            </Text>
            <Text
              backgroundColor={mode === "save-as" ? theme.surface0 : undefined}
              color={mode === "save-as" ? theme.text : theme.subtext0}
            >
              {mode === "save-as" ? "> " : "  "}
              Save as new session
            </Text>
          </Box>
          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>
              ↑↓:choose  Enter:select  Esc:cancel
            </Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.subtext0}>
            {mode === "rename" ? "Rename session:" : "Save as new session:"}
          </Text>
          <Box marginTop={1}>
            <Text color={theme.text}>Name: </Text>
            <TextInput
              value={name}
              onChange={setName}
              onSubmit={handleNameSubmit}
              placeholder="my pipeline"
              focus={true}
            />
          </Box>
          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>Enter:save  Esc:cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
