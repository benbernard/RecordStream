/**
 * ConfirmDialog — generic yes/no confirmation modal.
 *
 * Used for stage deletion, fork deletion, etc.
 */

import { useKeyboard } from "@opentui/react";

export interface ConfirmDialogProps {
  /** The question to display */
  message: string;
  /** Called when user confirms (y/Enter) */
  onConfirm: () => void;
  /** Called when user cancels (n/Esc) */
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useKeyboard((key) => {
    if (key.raw === "y" || key.name === "return") {
      onConfirm();
    } else if (key.raw === "n" || key.name === "escape") {
      onCancel();
    }
  });

  return (
    <box
      flexDirection="column"
      borderStyle="single"
      padding={1}
      width={50}
    >
      <text>{message}</text>
      <box height={1} marginTop={1}>
        <text fg="#666666">[y/Enter] confirm  [n/Esc] cancel</text>
      </box>
    </box>
  );
}
