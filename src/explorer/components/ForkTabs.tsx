/**
 * ForkTabs — tab bar above stage list for switching between forks.
 *
 * Hidden when there is only one fork. When visible, shows fork names
 * as selectable tabs using Ink + Catppuccin.
 */

import { useMemo, memo } from "react";
import { Box, Text } from "ink";
import type { PipelineState } from "../model/types.ts";
import { theme } from "../theme.ts";

export interface ForkTabsProps {
  state: PipelineState;
}

export const ForkTabs = memo(function ForkTabs({ state }: ForkTabsProps) {
  const forks = useMemo(
    () => Array.from(state.forks.values()).sort((a, b) => a.createdAt - b.createdAt),
    [state.forks],
  );

  if (state.forks.size <= 1) return null;

  return (
    <Box height={1} flexDirection="row">
      {forks.map((fork) => {
        const isActive = fork.id === state.activeForkId;
        return (
          <Text
            key={fork.id}
            backgroundColor={isActive ? theme.surface0 : undefined}
            color={isActive ? theme.text : theme.overlay0}
          >
            {isActive ? "[" : " "}
            {fork.name}
            {isActive ? "]" : " "}
          </Text>
        );
      })}
    </Box>
  );
});
