/**
 * FieldSpotlight — value distribution analysis for a single field.
 *
 * Activated by pressing `F` when a column is highlighted in table view.
 * Shows:
 * - Value frequency bar chart (Unicode blocks)
 * - Numeric stats: min/max/avg (if applicable)
 * - Navigable value list; Enter → grep for that value
 * - s → sort, c → collate, Esc → close
 */

import { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { CachedResult, StageConfig } from "../../model/types.ts";
import { theme } from "../../theme.ts";

export interface FieldSpotlightProps {
  fieldName: string;
  result: CachedResult;
  onAddStage: (config: StageConfig) => void;
  onClose: () => void;
}

interface ValueFrequency {
  value: string;
  rawValue: unknown;
  count: number;
  pct: number;
}

interface NumericStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  nullCount: number;
}

function computeFrequencies(result: CachedResult, fieldName: string): ValueFrequency[] {
  const counts = new Map<string, { count: number; rawValue: unknown }>();
  for (const record of result.records) {
    const val = record.get(fieldName);
    const key = val === null || val === undefined ? "(null)" : String(val);
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, { count: 1, rawValue: val });
    }
  }

  const total = result.records.length;
  const freqs: ValueFrequency[] = [];
  for (const [value, { count, rawValue }] of counts) {
    freqs.push({ value, rawValue, count, pct: total > 0 ? (count / total) * 100 : 0 });
  }
  freqs.sort((a, b) => b.count - a.count);
  return freqs;
}

function computeNumericStats(result: CachedResult, fieldName: string): NumericStats | null {
  const nums: number[] = [];
  let nullCount = 0;
  for (const record of result.records) {
    const val = record.get(fieldName);
    if (val === null || val === undefined) {
      nullCount++;
      continue;
    }
    const n = Number(val);
    if (!Number.isNaN(n)) {
      nums.push(n);
    }
  }
  if (nums.length === 0) return null;

  nums.sort((a, b) => a - b);
  const sum = nums.reduce((s, v) => s + v, 0);
  const mid = Math.floor(nums.length / 2);
  const median =
    nums.length % 2 === 0
      ? (nums[mid - 1]! + nums[mid]!) / 2
      : nums[mid]!;

  return {
    min: nums[0]!,
    max: nums[nums.length - 1]!,
    avg: sum / nums.length,
    median,
    nullCount,
  };
}

const BAR_CHARS = ["░", "▒", "▓", "█"];

function renderBar(pct: number, maxWidth: number): string {
  const filled = Math.round((pct / 100) * maxWidth);
  if (filled === 0 && pct > 0) return BAR_CHARS[0]!;

  // Use denser blocks for higher fill
  const result: string[] = [];
  for (let i = 0; i < filled; i++) {
    const ratio = (i + 1) / maxWidth;
    if (ratio > 0.75) result.push(BAR_CHARS[3]!);
    else if (ratio > 0.5) result.push(BAR_CHARS[2]!);
    else if (ratio > 0.25) result.push(BAR_CHARS[1]!);
    else result.push(BAR_CHARS[0]!);
  }
  return result.join("");
}

export function FieldSpotlight({ fieldName, result, onAddStage, onClose }: FieldSpotlightProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const frequencies = useMemo(() => computeFrequencies(result, fieldName), [result, fieldName]);
  const stats = useMemo(() => computeNumericStats(result, fieldName), [result, fieldName]);

  const maxVisible = 20;
  const visibleFreqs = frequencies.slice(0, maxVisible);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow || input === "k") {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex((i) => Math.min(visibleFreqs.length - 1, i + 1));
      return;
    }
    // Enter → grep for selected value
    if (key.return) {
      const entry = visibleFreqs[selectedIndex];
      if (entry) {
        const val = entry.value === "(null)" ? "" : entry.value;
        onAddStage({
          operationName: "grep",
          args: [`\${${fieldName}} eq "${val}"`],
          enabled: true,
        });
      }
      return;
    }
    // s → sort by this field
    if (input === "s") {
      onAddStage({
        operationName: "sort",
        args: ["--key", fieldName],
        enabled: true,
      });
      return;
    }
    // c → collate by this field
    if (input === "c") {
      onAddStage({
        operationName: "collate",
        args: ["--key", fieldName, "--aggregator", "count,countAll"],
        enabled: true,
      });
      return;
    }
  });

  const BAR_WIDTH = 20;
  const valueWidth = 30;
  const uniqueCount = frequencies.length;
  const totalRecords = result.records.length;

  return (
    <Box
      flexDirection="column"
      width="70%"
      height="80%"
      borderStyle="single"
      borderColor={theme.surface1}
      padding={1}
    >
      {/* Title */}
      <Box height={1} flexDirection="row" justifyContent="space-between">
        <Text color={theme.text}>
          Field Spotlight: <Text color={theme.yellow}>{fieldName}</Text>
        </Text>
        <Text color={theme.overlay0}>[Esc] close</Text>
      </Box>

      {/* Summary line */}
      <Box marginTop={1}>
        <Text color={theme.subtext0}>
          {totalRecords} records | {uniqueCount} unique values
          {stats ? ` | min: ${stats.min} max: ${stats.max} avg: ${stats.avg.toFixed(2)} median: ${stats.median}` : ""}
          {stats?.nullCount ? ` | ${stats.nullCount} null` : ""}
        </Text>
      </Box>

      {/* Header */}
      <Box marginTop={1}>
        <Text color={theme.subtext0}>
          {"  "}{"Value".padEnd(valueWidth)}  {"Count".padStart(6)}  {"  %".padStart(5)}  Bar
        </Text>
      </Box>

      {/* Frequency list */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visibleFreqs.map((entry, i) => {
          const isSelected = i === selectedIndex;
          const prefix = isSelected ? "> " : "  ";
          const valStr = entry.value.length > valueWidth
            ? entry.value.slice(0, valueWidth - 3) + "..."
            : entry.value.padEnd(valueWidth);
          const countStr = String(entry.count).padStart(6);
          const pctStr = entry.pct.toFixed(1).padStart(5);
          const bar = renderBar(entry.pct, BAR_WIDTH);

          return (
            <Text
              key={i}
              backgroundColor={isSelected ? theme.surface0 : undefined}
              color={isSelected ? theme.text : theme.subtext0}
            >
              {prefix}{valStr}  {countStr}  {pctStr}%  {bar}
            </Text>
          );
        })}
        {frequencies.length > maxVisible && (
          <Text color={theme.overlay0}>
            ... and {frequencies.length - maxVisible} more unique values
          </Text>
        )}
      </Box>

      {/* Footer */}
      <Box height={1} marginTop={1}>
        <Text color={theme.overlay0}>
          ↑↓:navigate  Enter:grep value  s:sort  c:collate  Esc:close
        </Text>
      </Box>
    </Box>
  );
}
