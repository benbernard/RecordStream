/**
 * ForkManager — modal for creating, switching, and deleting forks.
 *
 * Lists all forks with their fork-point stage label. The active fork is
 * highlighted. Users can:
 * - Enter/Space: switch to the selected fork
 * - n: create a new fork at the current cursor stage
 * - d: delete the selected fork (with confirmation guard for non-main forks)
 * - Esc: close
 */

import { useState, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type { PipelineState, PipelineAction } from "../../model/types.ts";
import { theme } from "../../theme.ts";

export interface ForkManagerProps {
  state: PipelineState;
  dispatch: (action: PipelineAction) => void;
  onClose: () => void;
  onShowStatus: (msg: string) => void;
}

export function ForkManager({
  state,
  dispatch,
  onClose,
  onShowStatus,
}: ForkManagerProps) {
  const forks = useMemo(
    () =>
      Array.from(state.forks.values()).sort(
        (a, b) => a.createdAt - b.createdAt,
      ),
    [state.forks],
  );

  const initialIndex = Math.max(
    0,
    forks.findIndex((f) => f.id === state.activeForkId),
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [isNaming, setIsNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const selected = forks[selectedIndex];

  const handleNameSubmit = useCallback(
    (val: string) => {
      const name = val.trim() || `fork-${forks.length}`;
      if (state.cursorStageId) {
        dispatch({ type: "CREATE_FORK", name, atStageId: state.cursorStageId });
        onShowStatus(`Created fork "${name}"`);
      } else {
        onShowStatus("No cursor stage — cannot fork");
      }
      setIsNaming(false);
      setNewName("");
      onClose();
    },
    [forks.length, state.cursorStageId, dispatch, onShowStatus, onClose],
  );

  // Keyboard when confirming delete
  useInput((input, key) => {
    if (input === "y" || key.return) {
      if (selected && selected.parentForkId !== null) {
        dispatch({ type: "DELETE_FORK", forkId: selected.id });
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        onShowStatus(`Deleted fork "${selected.name}"`);
      }
      setConfirmingDelete(false);
    } else if (input === "n" || key.escape) {
      setConfirmingDelete(false);
    }
  }, { isActive: confirmingDelete });

  // Keyboard when naming a new fork — only Escape (TextInput handles chars + Enter via onSubmit)
  useInput((_input, key) => {
    if (key.escape) {
      setIsNaming(false);
      setNewName("");
    }
  }, { isActive: isNaming });

  // Keyboard for normal list navigation
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(forks.length - 1, i + 1));
    } else if (key.return || input === " ") {
      if (selected && selected.id !== state.activeForkId) {
        dispatch({ type: "SWITCH_FORK", forkId: selected.id });
        onShowStatus(`Switched to fork "${selected.name}"`);
        onClose();
      }
    } else if (input === "n") {
      setIsNaming(true);
    } else if (input === "d") {
      if (selected && selected.parentForkId !== null) {
        setConfirmingDelete(true);
      } else {
        onShowStatus("Cannot delete the main fork");
      }
    }
  }, { isActive: !confirmingDelete && !isNaming });

  return (
    <Box
      flexDirection="column"
      width={50}
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text} bold>Fork Manager</Text>
        <Text color={theme.overlay0}>[Esc] close</Text>
      </Box>

      {confirmingDelete && selected ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text}>Delete fork &quot;{selected.name}&quot;?</Text>
          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>[y/Enter] confirm  [n/Esc] cancel</Text>
          </Box>
        </Box>
      ) : isNaming ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text}>New fork name:</Text>
          <Box marginTop={1}>
            <TextInput
              value={newName}
              onChange={setNewName}
              onSubmit={handleNameSubmit}
              placeholder="fork name..."
              focus={true}
            />
          </Box>
          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>Enter:create  Esc:cancel</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box flexDirection="column" marginTop={1}>
            {forks.map((fork, idx) => {
              const isSelected = idx === selectedIndex;
              const isActive = fork.id === state.activeForkId;
              const forkPoint = fork.forkPointStageId
                ? state.stages.get(fork.forkPointStageId)?.config.operationName
                : null;
              const stageCount = fork.stageIds.length;

              return (
                <Box key={fork.id} flexDirection="column">
                  <Text
                    backgroundColor={isSelected ? theme.surface0 : undefined}
                    color={isSelected ? theme.text : isActive ? theme.blue : theme.subtext0}
                  >
                    {isSelected ? "> " : "  "}
                    {fork.name}
                    {isActive ? " (active)" : ""}
                  </Text>
                  <Text color={theme.overlay0}>
                    {"    "}
                    {stageCount} stage{stageCount !== 1 ? "s" : ""}
                    {forkPoint ? ` • from: ${forkPoint}` : " • root"}
                  </Text>
                </Box>
              );
            })}
          </Box>

          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>
              ↑↓:navigate  Enter:switch  n:new  d:delete  Esc:close
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
