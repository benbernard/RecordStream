/**
 * SchemaView — field analysis view for the inspector panel.
 *
 * Displays a table of all fields found in the cached result:
 * - Field name
 * - Inferred type(s) (string, number, boolean, null, object, array)
 * - Sample values (up to 3 distinct)
 * - % populated (non-null/undefined across all records)
 */

import { useMemo } from "react";
import { Box, Text } from "ink";
import type { CachedResult } from "../model/types.ts";
import { theme } from "../theme.ts";

export interface SchemaViewProps {
  result: CachedResult;
}

export interface FieldSchema {
  name: string;
  types: string[];
  sampleValues: string[];
  populatedPct: number;
}

export function inferType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value; // "string" | "number" | "boolean" | "object"
}

export function analyzeFields(result: CachedResult): FieldSchema[] {
  const { records, fieldNames } = result;
  if (records.length === 0 || fieldNames.length === 0) return [];

  const totalRecords = records.length;

  return fieldNames.map((name) => {
    const typeSet = new Set<string>();
    const sampleSet = new Set<string>();
    let populated = 0;

    for (const record of records) {
      const val = record.get(name);
      if (val !== null && val !== undefined) {
        populated++;
        typeSet.add(inferType(val));
        if (sampleSet.size < 3) {
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          const truncated = str.length > 25 ? str.slice(0, 22) + "..." : str;
          sampleSet.add(truncated);
        }
      } else {
        typeSet.add("null");
      }
    }

    const types = Array.from(typeSet).sort();
    const sampleValues = Array.from(sampleSet);
    const populatedPct = totalRecords > 0 ? Math.round((populated / totalRecords) * 100) : 0;

    return { name, types, sampleValues, populatedPct };
  });
}

export function SchemaView({ result }: SchemaViewProps) {
  const fields = useMemo(() => analyzeFields(result), [result]);

  if (fields.length === 0) {
    return <Text color={theme.overlay0}>(no fields to analyze)</Text>;
  }

  // Compute column widths
  const nameWidth = Math.min(
    Math.max(5, ...fields.map((f) => f.name.length)),
    25,
  );
  const typeWidth = Math.min(
    Math.max(5, ...fields.map((f) => f.types.join(", ").length)),
    20,
  );
  const pctWidth = 4;
  const sampleWidth = 40;

  const headerStr =
    "Field".padEnd(nameWidth) +
    "  " +
    "Type".padEnd(typeWidth) +
    "  " +
    "%Pop".padStart(pctWidth) +
    "  " +
    "Sample Values";

  const separator = "─".repeat(nameWidth + typeWidth + pctWidth + sampleWidth + 6);

  // Color for type labels
  function typeColor(types: string[]): string {
    if (types.length > 1) return theme.flamingo;
    const t = types[0];
    if (t === "string") return theme.green;
    if (t === "number") return theme.teal;
    if (t === "boolean") return theme.yellow;
    if (t === "null") return theme.overlay0;
    if (t === "array") return theme.peach;
    if (t === "object") return theme.mauve;
    return theme.text;
  }

  // Color for population percentage
  function pctColor(pct: number): string {
    if (pct >= 90) return theme.green;
    if (pct >= 50) return theme.yellow;
    return theme.red;
  }

  return (
    <Box flexDirection="column">
      <Text color={theme.lavender} bold>{headerStr}</Text>
      <Text color={theme.surface1}>{separator}</Text>
      {fields.map((field, i) => {
        const nameCol = field.name.padEnd(nameWidth).slice(0, nameWidth);
        const typeCol = field.types.join(", ").padEnd(typeWidth).slice(0, typeWidth);
        const pctCol = `${field.populatedPct}%`.padStart(pctWidth);
        const sampleCol = field.sampleValues.join(", ").slice(0, sampleWidth);
        return (
          <Text key={i}>
            <Text color={theme.blue}>{nameCol}</Text>
            <Text color={theme.surface1}>  </Text>
            <Text color={typeColor(field.types)}>{typeCol}</Text>
            <Text color={theme.surface1}>  </Text>
            <Text color={pctColor(field.populatedPct)}>{pctCol}</Text>
            <Text color={theme.surface1}>  </Text>
            <Text color={theme.subtext0}>{sampleCol}</Text>
          </Text>
        );
      })}
      <Box marginTop={1}>
        <Text>
          <Text color={theme.teal}>{result.recordCount}</Text>
          <Text color={theme.overlay0}> records, </Text>
          <Text color={theme.teal}>{fields.length}</Text>
          <Text color={theme.overlay0}> fields</Text>
        </Text>
      </Box>
    </Box>
  );
}
