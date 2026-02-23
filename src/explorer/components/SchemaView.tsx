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

  const header =
    "Field".padEnd(nameWidth) +
    "  " +
    "Type".padEnd(typeWidth) +
    "  " +
    "%Pop".padStart(pctWidth) +
    "  " +
    "Sample Values";

  const separator = "-".repeat(nameWidth + typeWidth + pctWidth + sampleWidth + 6);

  const rows = fields.map((field) => {
    const nameCol = field.name.padEnd(nameWidth).slice(0, nameWidth);
    const typeCol = field.types.join(", ").padEnd(typeWidth).slice(0, typeWidth);
    const pctCol = `${field.populatedPct}%`.padStart(pctWidth);
    const sampleCol = field.sampleValues.join(", ").slice(0, sampleWidth);
    return `${nameCol}  ${typeCol}  ${pctCol}  ${sampleCol}`;
  });

  return (
    <Box flexDirection="column">
      <Text color={theme.overlay0}>{header}</Text>
      <Text color={theme.surface1}>{separator}</Text>
      {rows.map((row, i) => (
        <Text key={i} color={theme.text}>{row}</Text>
      ))}
      <Box marginTop={1}>
        <Text color={theme.overlay0}>
          {result.recordCount} records, {fields.length} fields
        </Text>
      </Box>
    </Box>
  );
}
