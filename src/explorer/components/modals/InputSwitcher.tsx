/**
 * InputSwitcher — switch between or add input sources.
 *
 * Lists all current input sources with the active one highlighted.
 * - Enter/Space: switch to the selected input
 * - a: add a new file input (prompts for path)
 * - d: remove the selected input (cannot remove the last one)
 * - Esc: close
 *
 * When adding a file, a large-file check is performed (> 100MB warn,
 * > 1GB danger) and the onLargeFile callback is invoked so the parent
 * can show the LargeFileWarning modal before proceeding.
 */

import { useState, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { VimTextInput } from "../VimTextInput.tsx";
import type {
  PipelineState,
  PipelineAction,
  FileSizeWarning,
} from "../../model/types.ts";
import { FILE_SIZE_THRESHOLDS } from "../../model/types.ts";
import { theme } from "../../theme.ts";

export interface InputSwitcherProps {
  state: PipelineState;
  dispatch: (action: PipelineAction) => void;
  onClose: () => void;
  onShowStatus: (msg: string) => void;
  /** Called when a newly-added file exceeds a size threshold. */
  onLargeFile?: (warning: FileSizeWarning) => void;
}

export function InputSwitcher({
  state,
  dispatch,
  onClose,
  onShowStatus,
  onLargeFile,
}: InputSwitcherProps) {
  const inputs = useMemo(
    () => Array.from(state.inputs.values()),
    [state.inputs],
  );

  const initialIndex = Math.max(
    0,
    inputs.findIndex((i) => i.id === state.activeInputId),
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [isAdding, setIsAdding] = useState(false);
  const [newPath, setNewPath] = useState("");

  const selected = inputs[selectedIndex];

  async function addFileInput(path: string) {
    const label = path.split("/").pop() ?? path;

    // Check file size for large file warning
    try {
      const file = Bun.file(path);
      const size = file.size;

      if (size > FILE_SIZE_THRESHOLDS.danger || size > FILE_SIZE_THRESHOLDS.warn) {
        // Estimate records: assume ~200 bytes per JSON line
        const estimatedRecords = Math.round(size / 200);
        const stageCount = Math.max(1, state.forks.get(state.activeForkId)?.stageIds.length ?? 1);
        const projectedCacheBytes = size * stageCount;

        const warning: FileSizeWarning = {
          path,
          fileBytes: size,
          estimatedRecords,
          projectedCacheBytes,
          acknowledged: false,
        };

        if (onLargeFile) {
          onLargeFile(warning);
          // The parent will handle adding the input after the user acknowledges
          onClose();
          return;
        }
      }
    } catch {
      // File may not exist yet or stat failed — proceed without warning
    }

    dispatch({
      type: "ADD_INPUT",
      source: { kind: "file", path },
      label,
    });
    onShowStatus(`Added input "${label}"`);
    onClose();
  }

  const handlePathSubmit = useCallback(
    (val: string) => {
      const path = val.trim();
      if (path) {
        void addFileInput(path);
      }
      setIsAdding(false);
      setNewPath("");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, dispatch, onShowStatus, onClose, onLargeFile],
  );

  // Adding phase: VimTextInput handles Escape (via onEscape) and Enter (via onSubmit),
  // so no separate useInput handler is needed for the adding phase.

  const handleAddingEscape = useCallback(() => {
    setIsAdding(false);
    setNewPath("");
  }, []);

  // Keyboard for normal list navigation
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(inputs.length - 1, i + 1));
    } else if (key.return || input === " ") {
      if (selected && selected.id !== state.activeInputId) {
        dispatch({ type: "SWITCH_INPUT", inputId: selected.id });
        onShowStatus(`Switched to input "${selected.label}"`);
        onClose();
      }
    } else if (input === "a") {
      setIsAdding(true);
    } else if (input === "d") {
      if (selected && state.inputs.size > 1) {
        dispatch({ type: "REMOVE_INPUT", inputId: selected.id });
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        onShowStatus(`Removed input "${selected.label}"`);
      } else {
        onShowStatus("Cannot remove the only input");
      }
    }
  }, { isActive: !isAdding });

  return (
    <Box
      flexDirection="column"
      width={55}
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text} bold>Input Sources</Text>
        <Text color={theme.overlay0}>[Esc] close</Text>
      </Box>

      {isAdding ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.text}>File path:</Text>
          <Box marginTop={1}>
            <VimTextInput
              value={newPath}
              onChange={setNewPath}
              onSubmit={handlePathSubmit}
              onEscape={handleAddingEscape}
              placeholder="/path/to/file.jsonl"
              focus={true}
            />
          </Box>
          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>Enter:add  Esc:vim  Esc(2x):cancel</Text>
          </Box>
        </Box>
      ) : (
        <>
          <Box flexDirection="column" marginTop={1}>
            {inputs.map((input, idx) => {
              const isSelected = idx === selectedIndex;
              const isActive = input.id === state.activeInputId;
              const sourceDesc =
                input.source.kind === "file"
                  ? input.source.path
                  : `stdin (${input.source.records.length} records)`;

              return (
                <Box key={input.id} flexDirection="column">
                  <Text
                    backgroundColor={isSelected ? theme.surface0 : undefined}
                    color={isSelected ? theme.text : isActive ? theme.blue : theme.subtext0}
                  >
                    {isSelected ? "> " : "  "}
                    {input.label}
                    {isActive ? " (active)" : ""}
                  </Text>
                  <Text color={theme.overlay0}>{"    "}{sourceDesc}</Text>
                </Box>
              );
            })}
            {inputs.length === 0 && (
              <Text color={theme.overlay0}>  No inputs — press a to add</Text>
            )}
          </Box>

          <Box height={1} marginTop={1}>
            <Text color={theme.overlay0}>
              ↑↓:navigate  Enter:switch  a:add  d:remove  Esc:close
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
