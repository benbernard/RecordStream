/**
 * LargeFileWarning — cache policy selection dialog for large files.
 *
 * Shown when an input file exceeds size thresholds:
 * - > 100MB (warn): yellow banner border
 * - > 1GB (danger): red dialog border, requires explicit confirmation
 *
 * Lets the user choose a cache policy:
 * - "all": cache every stage's output (default)
 * - "selective": only cache explicitly pinned stages (via `p` key)
 * - "none": never cache, always re-execute from source
 *
 * Displays file size, estimated records, and projected cache cost.
 */

import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { FileSizeWarning, CacheConfig } from "../../model/types.ts";
import { FILE_SIZE_THRESHOLDS } from "../../model/types.ts";
import { theme } from "../../theme.ts";

export type CachePolicy = CacheConfig["cachePolicy"];

export interface LargeFileWarningProps {
  warning: FileSizeWarning;
  /** Called when user selects a cache policy and confirms */
  onConfirm: (policy: CachePolicy) => void;
  /** Called when user cancels (Esc) — file is not added */
  onCancel: () => void;
}

const POLICIES: { policy: CachePolicy; label: string; description: string }[] = [
  {
    policy: "all",
    label: "Cache all",
    description: "Cache every stage's output (uses the most disk space)",
  },
  {
    policy: "selective",
    label: "Cache selectively",
    description: "Only cache stages you pin with the 'p' key",
  },
  {
    policy: "none",
    label: "No caching",
    description: "Always re-execute from source (slowest, no disk usage)",
  },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `~${(n / 1_000).toFixed(0)}K`;
  return `~${n}`;
}

export function LargeFileWarning({
  warning,
  onConfirm,
  onCancel,
}: LargeFileWarningProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isDanger = warning.fileBytes >= FILE_SIZE_THRESHOLDS.danger;
  const borderColor = isDanger ? theme.red : theme.yellow;
  const severityLabel = isDanger ? "LARGE FILE WARNING" : "Large File Notice";

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(POLICIES.length - 1, i + 1));
    } else if (key.return) {
      const policy = POLICIES[selectedIndex];
      if (policy) {
        onConfirm(policy.policy);
      }
    }
  });

  const fileName = warning.path.split("/").pop() ?? warning.path;

  return (
    <Box
      flexDirection="column"
      width={60}
      borderStyle="single"
      borderColor={borderColor}
      padding={1}
    >
      {/* Title */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={borderColor} bold>{severityLabel}</Text>
        <Text color={theme.overlay0}>[Esc] cancel</Text>
      </Box>

      {/* File info */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text}>
          File: <Text bold>{fileName}</Text>
        </Text>
        <Text color={theme.text}>Size: {formatBytes(warning.fileBytes)}</Text>
        <Text color={theme.text}>Estimated records: {formatCount(warning.estimatedRecords)}</Text>
        <Text color={theme.text}>
          Projected cache cost: {formatBytes(warning.projectedCacheBytes)}
        </Text>
      </Box>

      {/* Warning message */}
      <Box marginTop={1}>
        <Text color={borderColor}>
          {isDanger
            ? "This file is very large. Caching all intermediate results may use significant disk space and memory."
            : "This file is moderately large. Consider selective caching to reduce disk usage."}
        </Text>
      </Box>

      {/* Policy selection */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={theme.text}>Choose a cache policy:</Text>
        {POLICIES.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <Box key={opt.policy} flexDirection="column">
              <Text
                backgroundColor={isSelected ? theme.surface0 : undefined}
                color={isSelected ? theme.text : theme.subtext0}
              >
                {isSelected ? "> " : "  "}
                {opt.label}
              </Text>
              <Text color={theme.overlay0}>{"    "}{opt.description}</Text>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>↑↓:navigate  Enter:confirm  Esc:cancel</Text>
      </Box>
    </Box>
  );
}
