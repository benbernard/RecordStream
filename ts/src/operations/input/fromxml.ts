import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { XMLParser } from "fast-xml-parser";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Parse XML documents into records.
 *
 * Analogous to App::RecordStream::Operation::fromxml in Perl.
 */
export class FromXml extends Operation {
  private elements: string[] = [];
  private nested = false;
  private extraArgs: string[] = [];

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "element",
        type: "string",
        handler: (v) => {
          this.elements.push(...(v as string).split(","));
        },
        description: "Element names to extract records from",
      },
      {
        long: "nested",
        type: "boolean",
        handler: () => {
          this.nested = true;
        },
        description: "Search for elements at all levels",
      },
    ];

    this.extraArgs = this.parseOptions(args, defs);

    // Deduplicate elements
    this.elements = [...new Set(this.elements)];
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    if (this.extraArgs.length > 0) {
      for (const uri of this.extraArgs) {
        this.updateCurrentFilename(uri);
        const xml = this.getXmlString(uri);
        if (xml) {
          this.parseXml(xml);
        }
      }
    }
  }

  parseXml(xml: string): void {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      isArray: (_name: string, _jpath: string) => false,
      // We need to handle this manually since fast-xml-parser handles arrays differently
    });

    const doc = parser.parse(xml) as JsonObject;

    for (const element of this.elements) {
      const addElement = this.elements.length > 1;
      this.findElements(doc, element, addElement, 0);
    }
  }

  private findElements(
    obj: JsonValue,
    elementName: string,
    addElementField: boolean,
    depth: number
  ): void {
    if (obj === null || obj === undefined || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.findElements(item, elementName, addElementField, depth);
      }
      return;
    }

    const data = obj as JsonObject;

    // For top-level: look inside root element's children (depth 1)
    // With nested, look at all depths
    for (const key of Object.keys(data)) {
      const value = data[key];

      if (key === elementName) {
        // Check for attribute-style access (value is a scalar - from attribute)
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          // This is an attribute match
          if (depth >= 1 || this.nested) {
            const record = new Record();
            if (addElementField) {
              record.set("element", elementName);
            }
            record.set("value", value);
            this.pushRecord(record);
          }
        } else if (Array.isArray(value)) {
          // Array of elements
          if (depth >= 1 || this.nested) {
            for (const item of value) {
              this.pushValue(item, addElementField ? { element: elementName } : {});
            }
          }
        } else if (typeof value === "object" && value !== null) {
          // Single element
          if (depth >= 1 || this.nested) {
            this.pushValue(value, addElementField ? { element: elementName } : {});
          }
        }
      }

      // Recurse into child objects
      if (typeof value === "object" && value !== null) {
        if (depth >= 1 || this.nested) {
          this.findElements(value, elementName, addElementField, depth + 1);
        } else if (depth === 0) {
          this.findElements(value, elementName, addElementField, depth + 1);
        }
      }
    }
  }

  private pushValue(value: JsonValue, defaults: JsonObject): void {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const data = { ...(value as JsonObject) };
      for (const [k, v] of Object.entries(defaults)) {
        data[k] = v;
      }
      this.pushRecord(new Record(normalizeXmlObject(data)));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        this.pushValue(item, defaults);
      }
    } else {
      const data: JsonObject = { ...defaults, value: value };
      this.pushRecord(new Record(data));
    }
  }

  private getXmlString(uri: string): string | null {
    if (uri.startsWith("file:")) {
      const path = uri.slice(5);
      const fs = require("node:fs") as typeof import("node:fs");
      return fs.readFileSync(path, "utf-8");
    }

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      // For HTTP URIs, use synchronous fetch (Bun supports top-level await)
      // In practice this should be async, but matching Perl's sync behavior
      const result = Bun.spawnSync([
        "curl",
        "-sL",
        uri,
      ]);
      if (result.success) {
        return result.stdout.toString();
      }
      console.error(`GET uri: '${uri}' failed, skipping!`);
      return null;
    }

    // Treat as file path
    const fs = require("node:fs") as typeof import("node:fs");
    return fs.readFileSync(uri, "utf-8");
  }
}

/**
 * Normalize XML-parsed objects to match Perl's XML::Twig simplify behavior.
 * - Text content nodes stored as "#text" should become the value directly
 * - Single-element arrays should be kept as arrays (matching forcearray => 1)
 */
function normalizeXmlObject(obj: JsonObject): JsonObject {
  const result: JsonObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "#text") {
      // Skip text nodes at object level - they're handled by parent
      continue;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const inner = value as JsonObject;
      // If the object only has #text, use the text value
      const innerKeys = Object.keys(inner);
      if (innerKeys.length === 1 && innerKeys[0] === "#text") {
        result[key] = inner["#text"]!;
      } else {
        result[key] = normalizeXmlObject(inner);
      }
    } else if (Array.isArray(value)) {
      // Normalize array items
      const normalized = value.map((item) => {
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          const inner = item as JsonObject;
          const innerKeys = Object.keys(inner);
          if (innerKeys.length === 1 && innerKeys[0] === "#text") {
            return inner["#text"]!;
          }
          return normalizeXmlObject(inner);
        }
        return item;
      });
      result[key] = normalized;
    } else {
      result[key] = value;
    }
  }

  return result;
}
