/**
 * Root Explorer application component.
 *
 * Renders the WelcomeScreen when no input is provided,
 * or the MainLayout when a pipeline is active.
 *
 * Integrates useReducer for state management, useInput for global
 * keyboard handling, and wires together all sub-components.
 *
 * ─── Ink ↔ OpenTUI Mapping ───────────────────────────────────────
 * | OpenTUI                        | Ink                           |
 * |--------------------------------|-------------------------------|
 * | import { useKeyboard }         | import { useInput }           |
 * |   from "@opentui/react"        |   from "ink"                  |
 * | useKeyboard((key) => {})       | useInput((input, key) => {})  |
 * | key.name === "escape"          | key.escape                    |
 * | key.name === "return"          | key.return                    |
 * | key.name === "up"              | key.upArrow                   |
 * | key.name === "down"            | key.downArrow                 |
 * | key.name === "left"            | key.leftArrow                 |
 * | key.name === "right"           | key.rightArrow                |
 * | key.name === "tab"             | key.tab                       |
 * | key.raw === "k"                | input === "k"                 |
 * | key.name === "c" && key.ctrl   | input === "c" && key.ctrl     |
 * | <box>                          | <Box> (from ink)              |
 * | <text>                         | <Text> (from ink)             |
 * | <text fg="#abc">               | <Text color="#abc">           |
 * | <text bg="#abc">               | <Text backgroundColor="#abc"> |
 * | <scrollbox>                    | <Box> + manual scroll state   |
 * | renderer.destroy()             | useApp().exit()               |
 * | createCliRenderer()            | render() from ink             |
 * ──────────────────────────────────────────────────────────────────
 */

import { useReducer, useState, useCallback, useRef } from "react";
import { Box, useInput, useApp } from "ink";
import type { ExplorerOptions } from "../index.tsx";
import type { PipelineAction, StageConfig, FileSizeWarning } from "../model/types.ts";
import { pipelineReducer, createInitialState } from "../model/reducer.ts";
import { getCursorStage, getCursorOutput, getStageOutput, getDownstreamStages } from "../model/selectors.ts";
import { exportAsPipeScript, exportAsChainCommand, copyToClipboard } from "../model/serialization.ts";
import { detectInputOperation } from "../utils/file-detect.ts";
import { useExecution } from "../hooks/useExecution.ts";
import { useUndoRedo } from "../hooks/useUndoRedo.ts";
import { useAutoSave } from "../hooks/useAutoSave.ts";
import { useVimIntegration } from "../hooks/useVimIntegration.ts";
import { ExportPicker, type ExportFormat } from "./modals/ExportPicker.tsx";
import { WelcomeScreen, type SessionSummary } from "./WelcomeScreen.tsx";
import { TitleBar } from "./TitleBar.tsx";
import { StageList } from "./StageList.tsx";
import { ForkTabs } from "./ForkTabs.tsx";
import { InspectorPanel } from "./InspectorPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { AddStageModal } from "./modals/AddStageModal.tsx";
import { EditStageModal } from "./modals/EditStageModal.tsx";
import { ConfirmDialog } from "./modals/ConfirmDialog.tsx";
import { HelpPanel } from "./modals/HelpPanel.tsx";
import { ForkManager } from "./modals/ForkManager.tsx";
import { InputSwitcher } from "./modals/InputSwitcher.tsx";
import { LargeFileWarning, type CachePolicy } from "./modals/LargeFileWarning.tsx";
import { SessionPicker, type SessionMatch } from "./modals/SessionPicker.tsx";
import { SaveSessionModal } from "./modals/SaveSessionModal.tsx";
import { RecordDetail } from "./modals/RecordDetail.tsx";
import { FieldSpotlight } from "./modals/FieldSpotlight.tsx";
import { SessionManager } from "../session/session-manager.ts";

export interface AppProps {
  options: ExplorerOptions;
  /** Pre-loaded session summaries for the welcome screen */
  sessions?: SessionSummary[];
  /** Session matches for the current input file (for resume prompt) */
  sessionMatches?: SessionMatch[];
}

type ModalState =
  | { kind: "none" }
  | { kind: "addStage"; position: "after" | "before" }
  | { kind: "editStage" }
  | { kind: "confirmDelete"; stageId: string }
  | { kind: "help" }
  | { kind: "exportPicker" }
  | { kind: "forkManager" }
  | { kind: "inputSwitcher" }
  | { kind: "largeFileWarning"; warning: FileSizeWarning }
  | { kind: "sessionPicker" }
  | { kind: "saveSession" }
  | { kind: "recordDetail"; recordIndex: number }
  | { kind: "fieldSpotlight"; fieldName: string };

export function App({ options, sessions = [], sessionMatches = [] }: AppProps) {
  const { exit } = useApp();
  const hasInput = Boolean(options.inputFile || options.sessionId);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const [state, dispatch] = useReducer(pipelineReducer, undefined, () => {
    const initial = createInitialState();
    // If input file provided, add it as an input source
    if (options.inputFile) {
      let s = pipelineReducer(initial, {
        type: "ADD_INPUT",
        source: { kind: "file", path: options.inputFile },
        label: options.inputFile.split("/").pop() ?? options.inputFile,
      });
      // Auto-detect file type and insert the appropriate fromXXX stage
      const autoStage = detectInputOperation(options.inputFile);
      if (autoStage) {
        s = pipelineReducer(s, {
          type: "ADD_STAGE",
          afterStageId: null,
          config: autoStage,
        });
      }
      return s;
    }
    return initial;
  });

  const [modal, setModal] = useState<ModalState>(() =>
    // Show session picker on launch if there are matching sessions
    hasInput && sessionMatches.length > 0
      ? { kind: "sessionPicker" as const }
      : { kind: "none" as const },
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Undo/redo derived state for the StatusBar
  const undoRedo = useUndoRedo(state);

  // Auto-save hook
  const autoSave = useAutoSave(state);

  // Vim/$EDITOR integration
  const { openInEditor } = useVimIntegration();

  // Wrap dispatch to notify auto-save of actions.
  // Use a ref for state so wrappedDispatch identity stays stable — this is
  // critical because useExecution has `dispatch` in its dependency array.
  const stateRef = useRef(state);
  stateRef.current = state;
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;

  const wrappedDispatch = useCallback(
    (action: PipelineAction) => {
      dispatch(action);
      // Notify auto-save after dispatching (state will be stale here,
      // but auto-save debounces and uses latestState on save)
      autoSaveRef.current.onAction(action, stateRef.current);
    },
    [],
  );

  // Automatic pipeline execution: triggers on cursor/input/cache changes
  useExecution(state, wrappedDispatch);

  const showStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  // Global keyboard handler (Ink useInput)
  useInput((input, key) => {
    // Skip when a modal is open — modals handle their own input
    if (modal.kind !== "none") return;

    // Global keys (always active)
    // When the terminal event loop is busy, separate keystrokes can arrive
    // batched in a single DATA event (e.g., "nn" instead of two "n" events).
    // Use includes() for single-key commands to handle this case.
    if (input.includes("q") && !key.ctrl) {
      // Save session before quitting
      void autoSave.saveNow(state).finally(() => {
        exit();
      });
      return;
    }
    if (input.includes("?")) {
      setModal({ kind: "help" });
      return;
    }
    if (input.includes("u")) {
      wrappedDispatch({ type: "UNDO" });
      return;
    }
    if (input === "r" && key.ctrl) {
      wrappedDispatch({ type: "REDO" });
      return;
    }
    if (key.tab) {
      wrappedDispatch({ type: "TOGGLE_FOCUS" });
      return;
    }
    if (input === "c" && key.ctrl) {
      void autoSave.saveNow(state).finally(() => {
        exit();
      });
      return;
    }
    if (input.includes("x") && !key.shift) {
      const script = exportAsPipeScript(state);
      void copyToClipboard(script).then((ok) => {
        showStatus(ok ? "Copied pipe script!" : "Export: clipboard failed");
      });
      return;
    }
    if (input.includes("X")) {
      setModal({ kind: "exportPicker" });
      return;
    }
    if (input.includes("v")) {
      const output = getCursorOutput(state);
      if (output && output.records.length > 0) {
        void openInEditor(output.records);
      } else {
        showStatus("No records to export");
      }
      return;
    }

    // Save session
    if (input.includes("S")) {
      setModal({ kind: "saveSession" });
      return;
    }

    // Fork/input global keys
    if (input.includes("f")) {
      // Create fork at cursor directly with auto-name
      if (state.cursorStageId) {
        const forkName = `fork-${state.forks.size}`;
        wrappedDispatch({ type: "CREATE_FORK", name: forkName, atStageId: state.cursorStageId });
        showStatus(`Created fork "${forkName}" at cursor`);
      } else {
        showStatus("No cursor stage — cannot fork");
      }
      return;
    }
    if (input.includes("b")) {
      setModal({ kind: "forkManager" });
      return;
    }
    if (input.includes("i")) {
      setModal({ kind: "inputSwitcher" });
      return;
    }
    if (input.includes("p")) {
      // Pin/unpin stage for selective caching
      if (state.cursorStageId) {
        wrappedDispatch({ type: "PIN_STAGE", stageId: state.cursorStageId });
        showStatus("Toggled stage pin");
      }
      return;
    }

    // Pipeline panel keys
    if (state.focusedPanel === "pipeline") {
      if (key.upArrow || input.includes("k")) {
        wrappedDispatch({ type: "MOVE_CURSOR", direction: "up" });
        return;
      }
      if (key.downArrow || input.includes("j")) {
        wrappedDispatch({ type: "MOVE_CURSOR", direction: "down" });
        return;
      }
      if (input.includes("a") && !key.shift) {
        setModal({ kind: "addStage", position: "after" });
        return;
      }
      if (input.includes("A")) {
        if (state.cursorStageId) {
          setModal({ kind: "addStage", position: "before" });
        }
        return;
      }
      if (input.includes("d")) {
        if (state.cursorStageId) {
          setModal({ kind: "confirmDelete", stageId: state.cursorStageId });
        }
        return;
      }
      if (input.includes("e")) {
        if (state.cursorStageId) {
          setModal({ kind: "editStage" });
        }
        return;
      }
      if (input.includes(" ")) {
        if (state.cursorStageId) {
          wrappedDispatch({ type: "TOGGLE_STAGE", stageId: state.cursorStageId });
        }
        return;
      }
      if (input.includes("r") && !key.ctrl) {
        if (state.cursorStageId) {
          wrappedDispatch({ type: "INVALIDATE_STAGE", stageId: state.cursorStageId });
          const downstream = getDownstreamStages(state, state.cursorStageId);
          for (const s of downstream) {
            wrappedDispatch({ type: "INVALIDATE_STAGE", stageId: s.id });
          }
          showStatus("Re-running from cursor...");
        }
        return;
      }
      if (input.includes("J")) {
        if (state.cursorStageId) {
          wrappedDispatch({ type: "REORDER_STAGE", stageId: state.cursorStageId, direction: "down" });
        }
        return;
      }
      if (input.includes("K")) {
        if (state.cursorStageId) {
          wrappedDispatch({ type: "REORDER_STAGE", stageId: state.cursorStageId, direction: "up" });
        }
        return;
      }
      if (key.return) {
        wrappedDispatch({ type: "TOGGLE_FOCUS" });
        return;
      }
    }

    // Inspector panel keys
    if (state.focusedPanel === "inspector") {
      if (key.escape) {
        // If a column is highlighted, clear it first; otherwise return to pipeline
        if (state.inspector.highlightedColumn !== null) {
          wrappedDispatch({ type: "CLEAR_COLUMN_HIGHLIGHT" });
        } else {
          wrappedDispatch({ type: "TOGGLE_FOCUS" });
        }
        return;
      }
      if (input === "t") {
        const modes = ["table", "prettyprint", "json", "schema"] as const;
        const currentIdx = modes.indexOf(state.inspector.viewMode as typeof modes[number]);
        const nextIdx = (currentIdx + 1) % modes.length;
        wrappedDispatch({ type: "SET_VIEW_MODE", viewMode: modes[nextIdx]! });
        return;
      }
      if (key.return) {
        const output = getCursorOutput(state);
        if (output && output.records.length > 0) {
          setModal({ kind: "recordDetail", recordIndex: state.inspector.scrollOffset });
        }
        return;
      }

      // Column highlight navigation (table view only)
      if (state.inspector.viewMode === "table") {
        const output = getCursorOutput(state);
        const fieldCount = output?.fieldNames.length ?? 0;

        if (key.leftArrow || input === "h") {
          if (fieldCount > 0) {
            wrappedDispatch({ type: "MOVE_COLUMN_HIGHLIGHT", direction: "left", fieldCount });
          }
          return;
        }
        if (key.rightArrow || input === "l") {
          if (fieldCount > 0) {
            wrappedDispatch({ type: "MOVE_COLUMN_HIGHLIGHT", direction: "right", fieldCount });
          }
          return;
        }

        // Quick action keys — only when a column is highlighted
        if (state.inspector.highlightedColumn !== null && output) {
          const fieldName = output.fieldNames[state.inspector.highlightedColumn];
          if (fieldName) {
            // g → grep: filter records where this field matches current value
            if (input === "g") {
              const record = output.records[state.inspector.scrollOffset];
              const value = record ? String(record.get(fieldName) ?? "") : "";
              const config: StageConfig = {
                operationName: "grep",
                args: [`\${${fieldName}} eq "${value}"`],
                enabled: true,
              };
              wrappedDispatch({
                type: "ADD_STAGE",
                afterStageId: state.cursorStageId,
                config,
              });
              wrappedDispatch({ type: "CLEAR_COLUMN_HIGHLIGHT" });
              setModal({ kind: "editStage" });
              showStatus(`Added grep on ${fieldName}`);
              return;
            }
            // s → sort by this field
            if (input === "s") {
              const config: StageConfig = {
                operationName: "sort",
                args: ["--key", fieldName],
                enabled: true,
              };
              wrappedDispatch({
                type: "ADD_STAGE",
                afterStageId: state.cursorStageId,
                config,
              });
              wrappedDispatch({ type: "CLEAR_COLUMN_HIGHLIGHT" });
              setModal({ kind: "editStage" });
              showStatus(`Added sort on ${fieldName}`);
              return;
            }
            // c → collate by this field with count aggregator
            if (input === "c" && !key.ctrl) {
              const config: StageConfig = {
                operationName: "collate",
                args: ["--key", fieldName, "--aggregator", "count,countAll"],
                enabled: true,
              };
              wrappedDispatch({
                type: "ADD_STAGE",
                afterStageId: state.cursorStageId,
                config,
              });
              wrappedDispatch({ type: "CLEAR_COLUMN_HIGHLIGHT" });
              setModal({ kind: "editStage" });
              showStatus(`Added collate on ${fieldName}`);
              return;
            }
            // F → open field spotlight
            if (input === "F") {
              setModal({ kind: "fieldSpotlight", fieldName });
              return;
            }
          }
        }
      }
    }
  });

  const handleAddStageSelect = useCallback(
    (operationName: string) => {
      const config: StageConfig = {
        operationName,
        args: [],
        enabled: true,
      };
      if (modal.kind === "addStage" && modal.position === "before" && state.cursorStageId) {
        wrappedDispatch({
          type: "INSERT_STAGE_BEFORE",
          beforeStageId: state.cursorStageId,
          config,
        });
      } else {
        wrappedDispatch({
          type: "ADD_STAGE",
          afterStageId: state.cursorStageId,
          config,
        });
      }
      // Chain to edit args modal so user can configure the new stage
      setModal({ kind: "editStage" });
      showStatus(`Added ${operationName} stage`);
    },
    [modal, state.cursorStageId, showStatus, wrappedDispatch],
  );

  const handleEditStageSubmit = useCallback(
    (args: string[]) => {
      if (state.cursorStageId) {
        wrappedDispatch({
          type: "UPDATE_STAGE_ARGS",
          stageId: state.cursorStageId,
          args,
        });
      }
      setModal({ kind: "none" });
    },
    [state.cursorStageId, wrappedDispatch],
  );

  const handleConfirmDelete = useCallback(() => {
    if (modal.kind === "confirmDelete") {
      wrappedDispatch({ type: "DELETE_STAGE", stageId: modal.stageId });
      showStatus("Stage deleted");
    }
    setModal({ kind: "none" });
  }, [modal, showStatus, wrappedDispatch]);

  const handleExportFormat = useCallback(
    (format: ExportFormat) => {
      setModal({ kind: "none" });
      if (format === "pipe-script") {
        const text = exportAsPipeScript(state);
        void copyToClipboard(text).then((ok) => {
          showStatus(ok ? "Copied pipe script!" : "Export: clipboard failed");
        });
      } else if (format === "chain-command") {
        const text = exportAsChainCommand(state);
        void copyToClipboard(text).then((ok) => {
          showStatus(ok ? "Copied chain command!" : "Export: clipboard failed");
        });
      } else {
        // save-file
        const script = exportAsPipeScript(state);
        const tmpPath = `/tmp/recs-pipeline-${Date.now()}.sh`;
        void Bun.write(tmpPath, script).then(() => {
          showStatus(`Saved to ${tmpPath}`);
        });
      }
    },
    [state, showStatus],
  );

  const handleLargeFileConfirm = useCallback(
    (policy: CachePolicy) => {
      wrappedDispatch({ type: "SET_CACHE_POLICY", policy });
      // The file was already pending — add it now
      if (modal.kind === "largeFileWarning") {
        const { path } = modal.warning;
        const label = path.split("/").pop() ?? path;
        wrappedDispatch({
          type: "ADD_INPUT",
          source: { kind: "file", path },
          label,
        });
        showStatus(`Added large file with "${policy}" cache policy`);
      }
      setModal({ kind: "none" });
    },
    [modal, showStatus, wrappedDispatch],
  );

  const handleLargeFile = useCallback((warning: FileSizeWarning) => {
    setModal({ kind: "largeFileWarning", warning });
  }, []);

  const handleSessionResume = useCallback(
    (_sessionId: string) => {
      // Session resume is handled at the index.tsx level; for now, dismiss
      showStatus("Resuming session...");
      setModal({ kind: "none" });
    },
    [showStatus],
  );

  const handleSaveSession = useCallback(
    (name: string, mode: "rename" | "save-as") => {
      setModal({ kind: "none" });
      const mgr = new SessionManager();
      if (mode === "rename") {
        wrappedDispatch({ type: "SET_SESSION_NAME", name });
        void mgr.rename(state.sessionId, name).then(() => {
          void autoSave.saveNow(state);
          showStatus(`Session renamed to "${name}"`);
        });
      } else {
        // save-as: create a new session with a new ID
        void mgr.saveAs(state, name).then(() => {
          wrappedDispatch({ type: "SET_SESSION_NAME", name });
          showStatus(`Saved as new session "${name}"`);
        });
      }
    },
    [state, wrappedDispatch, autoSave, showStatus],
  );

  const handleSessionStartFresh = useCallback(() => {
    setModal({ kind: "none" });
  }, []);

  // Welcome screen — no input loaded
  if (!hasInput && !welcomeDismissed) {
    return (
      <WelcomeScreen
        sessions={sessions}
        onResumeSession={(sessionId) => {
          setWelcomeDismissed(true);
          showStatus(`Resuming session ${sessionId}...`);
        }}
        onOpenFile={(filePath) => {
          setWelcomeDismissed(true);
          const label = filePath.split("/").pop() ?? filePath;
          wrappedDispatch({
            type: "ADD_INPUT",
            source: { kind: "file", path: filePath },
            label,
          });
          // Auto-detect file type and insert fromXXX stage
          const autoStage = detectInputOperation(filePath);
          if (autoStage) {
            wrappedDispatch({
              type: "ADD_STAGE",
              afterStageId: null,
              config: autoStage,
            });
          }
        }}
        onNewPipeline={() => {
          setWelcomeDismissed(true);
        }}
      />
    );
  }

  const cursorStage = getCursorStage(state);
  const cursorLabel = cursorStage?.config.operationName;

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {/* Title bar */}
      <TitleBar state={state} />

      {/* Main content: pipeline list + inspector */}
      <Box flexDirection="row" flexGrow={1}>
        <Box width={30} flexDirection="column">
          {/* Fork tabs — hidden when only one fork */}
          <ForkTabs state={state} />
          <StageList state={state} dispatch={wrappedDispatch} />
        </Box>
        <InspectorPanel state={state} />
      </Box>

      {/* Status bar */}
      <StatusBar state={state} statusMessage={statusMessage} undoRedo={undoRedo} />

      {/* Modals */}
      {modal.kind === "addStage" && (() => {
        const output = getCursorOutput(state);
        return (
          <AddStageModal
            onSelect={handleAddStageSelect}
            onCancel={() => setModal({ kind: "none" })}
            afterLabel={modal.position === "before" ? `before: ${cursorLabel ?? "start"}` : cursorLabel}
            records={output?.records}
            fieldNames={output?.fieldNames}
          />
        );
      })()}
      {modal.kind === "editStage" && cursorStage && (() => {
        const parentOutput = cursorStage.parentId
          ? getStageOutput(state, cursorStage.parentId)
          : undefined;
        return (
          <EditStageModal
            operationName={cursorStage.config.operationName}
            currentArgs={cursorStage.config.args.join(" ")}
            onConfirm={handleEditStageSubmit}
            onCancel={() => setModal({ kind: "none" })}
            records={parentOutput?.records}
            fieldNames={parentOutput?.fieldNames}
          />
        );
      })()}
      {modal.kind === "confirmDelete" && (
        <ConfirmDialog
          message={`Delete stage "${cursorStage?.config.operationName ?? "?"}"?`}
          onConfirm={handleConfirmDelete}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "help" && (
        <HelpPanel onClose={() => setModal({ kind: "none" })} />
      )}
      {modal.kind === "exportPicker" && (
        <ExportPicker
          onSelect={handleExportFormat}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "forkManager" && (
        <ForkManager
          state={state}
          dispatch={wrappedDispatch}
          onClose={() => setModal({ kind: "none" })}
          onShowStatus={showStatus}
        />
      )}
      {modal.kind === "inputSwitcher" && (
        <InputSwitcher
          state={state}
          dispatch={wrappedDispatch}
          onClose={() => setModal({ kind: "none" })}
          onShowStatus={showStatus}
          onLargeFile={handleLargeFile}
        />
      )}
      {modal.kind === "largeFileWarning" && (
        <LargeFileWarning
          warning={modal.warning}
          onConfirm={handleLargeFileConfirm}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "sessionPicker" && (
        <SessionPicker
          filePath={options.inputFile ?? ""}
          sessions={sessionMatches}
          onResume={handleSessionResume}
          onStartFresh={handleSessionStartFresh}
        />
      )}
      {modal.kind === "saveSession" && (
        <SaveSessionModal
          currentName={state.sessionName}
          onConfirm={handleSaveSession}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}
      {modal.kind === "recordDetail" && (() => {
        const output = getCursorOutput(state);
        return output && output.records.length > 0 ? (
          <RecordDetail
            records={output.records}
            initialIndex={modal.recordIndex}
            onClose={() => setModal({ kind: "none" })}
            onShowStatus={showStatus}
          />
        ) : null;
      })()}
      {modal.kind === "fieldSpotlight" && (() => {
        const output = getCursorOutput(state);
        return output ? (
          <FieldSpotlight
            fieldName={modal.fieldName}
            result={output}
            onAddStage={(config) => {
              wrappedDispatch({
                type: "ADD_STAGE",
                afterStageId: state.cursorStageId,
                config,
              });
              wrappedDispatch({ type: "CLEAR_COLUMN_HIGHLIGHT" });
              setModal({ kind: "editStage" });
              showStatus(`Added ${config.operationName} on ${modal.fieldName}`);
            }}
            onClose={() => setModal({ kind: "none" })}
          />
        ) : null;
      })()}
    </Box>
  );
}
