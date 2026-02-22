/**
 * Root TUI application component.
 *
 * Renders the WelcomeScreen when no input is provided,
 * or the MainLayout when a pipeline is active.
 *
 * Integrates useReducer for state management, useKeyboard for global
 * keyboard handling, and wires together all sub-components.
 */

import { useReducer, useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { CliRenderer } from "@opentui/core";
import type { TuiOptions } from "../index.tsx";
import type { PipelineAction, StageConfig } from "../model/types.ts";
import { pipelineReducer, createInitialState } from "../model/reducer.ts";
import { getCursorStage } from "../model/selectors.ts";
import { TitleBar } from "./TitleBar.tsx";
import { StageList } from "./StageList.tsx";
import { InspectorPanel } from "./InspectorPanel.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { AddStageModal } from "./modals/AddStageModal.tsx";
import { EditStageModal } from "./modals/EditStageModal.tsx";
import { ConfirmDialog } from "./modals/ConfirmDialog.tsx";
import { HelpPanel } from "./modals/HelpPanel.tsx";

export interface AppProps {
  options: TuiOptions;
  renderer: CliRenderer;
}

type ModalState =
  | { kind: "none" }
  | { kind: "addStage" }
  | { kind: "editStage" }
  | { kind: "confirmDelete"; stageId: string }
  | { kind: "help" };

export function App({ options, renderer }: AppProps) {
  const hasInput = Boolean(options.inputFile || options.sessionId);

  const [state, dispatch] = useReducer(pipelineReducer, undefined, () => {
    const initial = createInitialState();
    // If input file provided, add it as an input source
    if (options.inputFile) {
      return pipelineReducer(initial, {
        type: "ADD_INPUT",
        source: { kind: "file", path: options.inputFile },
        label: options.inputFile.split("/").pop() ?? options.inputFile,
      });
    }
    return initial;
  });

  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const showStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  // Global keyboard handler
  useKeyboard((key) => {
    // Modal is open — don't handle global keys
    if (modal.kind !== "none") return;

    // Global keys (always active)
    if (key.name === "q" && !key.ctrl) {
      renderer.destroy();
      return;
    }
    if (key.raw === "?") {
      setModal({ kind: "help" });
      return;
    }
    if (key.raw === "u") {
      dispatch({ type: "UNDO" });
      return;
    }
    if (key.name === "r" && key.ctrl) {
      dispatch({ type: "REDO" });
      return;
    }
    if (key.name === "tab") {
      dispatch({ type: "TOGGLE_FOCUS" });
      return;
    }

    // Pipeline panel keys
    if (state.focusedPanel === "pipeline") {
      if (key.name === "up" || key.raw === "k") {
        dispatch({ type: "MOVE_CURSOR", direction: "up" });
        return;
      }
      if (key.name === "down" || key.raw === "j") {
        dispatch({ type: "MOVE_CURSOR", direction: "down" });
        return;
      }
      if (key.raw === "a") {
        setModal({ kind: "addStage" });
        return;
      }
      if (key.raw === "d") {
        if (state.cursorStageId) {
          setModal({ kind: "confirmDelete", stageId: state.cursorStageId });
        }
        return;
      }
      if (key.raw === "e") {
        if (state.cursorStageId) {
          setModal({ kind: "editStage" });
        }
        return;
      }
      if (key.raw === " ") {
        if (state.cursorStageId) {
          dispatch({ type: "TOGGLE_STAGE", stageId: state.cursorStageId });
        }
        return;
      }
      if (key.name === "return" || key.name === "tab") {
        dispatch({ type: "TOGGLE_FOCUS" });
        return;
      }
    }

    // Inspector panel keys
    if (state.focusedPanel === "inspector") {
      if (key.name === "escape") {
        dispatch({ type: "TOGGLE_FOCUS" });
        return;
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
      dispatch({
        type: "ADD_STAGE",
        afterStageId: state.cursorStageId,
        config,
      } satisfies PipelineAction);
      setModal({ kind: "none" });
      showStatus(`Added ${operationName} stage`);
    },
    [state.cursorStageId, showStatus],
  );

  const handleEditStageSubmit = useCallback(
    (args: string[]) => {
      if (state.cursorStageId) {
        dispatch({
          type: "UPDATE_STAGE_ARGS",
          stageId: state.cursorStageId,
          args,
        });
      }
      setModal({ kind: "none" });
    },
    [state.cursorStageId],
  );

  const handleConfirmDelete = useCallback(() => {
    if (modal.kind === "confirmDelete") {
      dispatch({ type: "DELETE_STAGE", stageId: modal.stageId });
      showStatus("Stage deleted");
    }
    setModal({ kind: "none" });
  }, [modal, showStatus]);

  if (!hasInput) {
    return (
      <box flexDirection="column" width="100%" height="100%">
        <text>Welcome to recs tui</text>
        <text> </text>
        <text>Open a file to start building a pipeline:</text>
        <text>  recs tui &lt;file&gt;</text>
        <text> </text>
        <text>Press q to quit</text>
      </box>
    );
  }

  const cursorStage = getCursorStage(state);
  const cursorLabel = cursorStage?.config.operationName;

  return (
    <box flexDirection="column" width="100%" height="100%">
      {/* Title bar */}
      <TitleBar state={state} />

      {/* Main content: pipeline list + inspector */}
      <box flexDirection="row" flexGrow={1}>
        <StageList state={state} dispatch={dispatch} />
        <InspectorPanel state={state} />
      </box>

      {/* Status bar */}
      <StatusBar state={state} statusMessage={statusMessage} />

      {/* Modals */}
      {modal.kind === "addStage" && (
        <AddStageModal
          onSelect={handleAddStageSelect}
          onCancel={() => setModal({ kind: "none" })}
          afterLabel={cursorLabel}
        />
      )}
      {modal.kind === "editStage" && cursorStage && (
        <EditStageModal
          operationName={cursorStage.config.operationName}
          currentArgs={cursorStage.config.args.join(" ")}
          onConfirm={handleEditStageSubmit}
          onCancel={() => setModal({ kind: "none" })}
        />
      )}
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
    </box>
  );
}
