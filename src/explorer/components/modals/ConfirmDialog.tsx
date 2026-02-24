/**
 * ConfirmDialog — generic yes/no confirmation modal.
 *
 * Used for stage deletion, fork deletion, etc.
 */

import { Box, Text, useInput } from "ink";
import { theme } from "../../theme.ts";

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
  useInput((input, key) => {
    if (input === "y" || key.return) {
      onConfirm();
    } else if (input === "n" || key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.yellow}
      padding={1}
      width={50}
    >
      <Text color={theme.yellow}>{message}</Text>
      <Box height={1} marginTop={1}>
        <Text>
          <Text color={theme.green}>[y/Enter]</Text>
          <Text color={theme.subtext0}> confirm  </Text>
          <Text color={theme.red}>[n/Esc]</Text>
          <Text color={theme.subtext0}> cancel</Text>
        </Text>
      </Box>
    </Box>
  );
}
