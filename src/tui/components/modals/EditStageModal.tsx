/**
 * EditStageModal — raw args text input for editing stage arguments.
 *
 * Phase 1: Simple single-line input for operation arguments.
 * Phase 2: Will add field autocomplete from upstream stage's fieldNames.
 */

import { useState } from "react";
import { useKeyboard } from "@opentui/react";

export interface EditStageModalProps {
  /** The operation name being edited */
  operationName: string;
  /** Current args as a single string (space-separated) */
  currentArgs: string;
  /** Called when user confirms edit */
  onConfirm: (args: string[]) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

export function EditStageModal({
  operationName,
  currentArgs,
  onConfirm,
  onCancel,
}: EditStageModalProps) {
  const [value, setValue] = useState(currentArgs);

  useKeyboard((key) => {
    if (key.name === "escape") {
      onCancel();
    } else if (key.name === "return") {
      // Split on whitespace, respecting simple quoting
      const args = parseArgs(value);
      onConfirm(args);
    }
  });

  return (
    <box
      flexDirection="column"
      width="60%"
      borderStyle="single"
      padding={1}
    >
      <box height={1} flexDirection="row" justifyContent="space-between">
        <text>
          Edit: <b>{operationName}</b>
        </text>
        <text fg="#666666">[Esc] cancel</text>
      </box>

      <box marginTop={1}>
        <text>Args: </text>
        <input
          value={value}
          onChange={setValue}
          placeholder="--key value ..."
          focused
          width={40}
        />
      </box>

      <box height={1} marginTop={1}>
        <text fg="#666666">Enter:confirm  Esc:cancel</text>
      </box>
    </box>
  );
}

/**
 * Parse a string of arguments, respecting single and double quotes.
 * Returns an array of argument strings.
 */
function parseArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}
