import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import { XMLParser } from "fast-xml-parser";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Parse Atom/RSS feed entries into records.
 *
 * Analogous to App::RecordStream::Operation::fromatomfeed in Perl.
 */
export class FromAtomFeed extends Operation {
  follow = true;
  max: number | null = null;
  urls: string[] = [];
  count = 0;

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "follow",
        type: "boolean",
        handler: () => {
          this.follow = true;
        },
        description: "Follow atom feed next links (default on)",
      },
      {
        long: "nofollow",
        type: "boolean",
        handler: () => {
          this.follow = false;
        },
        description: "Do not follow next links",
      },
      {
        long: "max",
        type: "string",
        handler: (v) => {
          this.max = parseInt(v as string, 10);
        },
        description: "Maximum number of entries",
      },
    ];

    this.urls = this.parseOptions(args, defs);
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    while (this.urls.length > 0) {
      const url = this.urls.shift()!;
      this.updateCurrentFilename(url);

      const content = this.fetchContent(url);
      if (!content) {
        console.error(`GET ${url} failed, skipping`);
        this.setExitValue(1);
        continue;
      }

      const shouldStop = this.parseFeed(content);
      if (shouldStop) break;
    }
  }

  parseFeed(xml: string): boolean {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      // Don't use isArray - we handle it manually
    });

    const doc = parser.parse(xml) as JsonObject;

    // Navigate to feed element
    const feed = (doc["feed"] ?? doc) as JsonObject;

    // Process entries
    const entries = feed["entry"];
    if (entries) {
      const entryList = Array.isArray(entries) ? entries : [entries];
      for (const entry of entryList) {
        if (this.max !== null && this.count >= this.max) {
          this.urls = [];
          return true;
        }
        this.count++;
        const record = simplifyEntry(entry as JsonObject);
        this.pushRecord(new Record(record));
      }
    }

    // Follow next link if enabled
    if (this.follow) {
      const links = feed["link"];
      if (links) {
        const linkList = Array.isArray(links) ? links : [links];
        for (const link of linkList) {
          if (typeof link === "object" && link !== null && !Array.isArray(link)) {
            const linkObj = link as JsonObject;
            if (linkObj["rel"] === "next" && typeof linkObj["href"] === "string") {
              this.urls.unshift(linkObj["href"]);
            }
          }
        }
      }
    }

    return false;
  }

  fetchContent(uri: string): string | null {
    if (uri.startsWith("file:")) {
      const path = uri.slice(5);
      const fs = require("node:fs") as typeof import("node:fs");
      try {
        return fs.readFileSync(path, "utf-8");
      } catch {
        return null;
      }
    }

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      const result = Bun.spawnSync(["curl", "-sL", uri]);
      if (result.success) {
        return result.stdout.toString();
      }
      return null;
    }

    // Treat as file path
    const fs = require("node:fs") as typeof import("node:fs");
    try {
      return fs.readFileSync(uri, "utf-8");
    } catch {
      return null;
    }
  }
}

/**
 * Simplify an Atom entry XML object to match Perl's XML::Twig simplify output.
 */
function simplifyEntry(entry: JsonObject): JsonObject {
  const result: JsonObject = {};

  for (const [key, value] of Object.entries(entry)) {
    if (key === "link") continue; // Skip link elements

    const simpleName = key.replace(/^.*:/, ""); // Strip namespace prefix for simple names
    // But keep dc:creator style keys
    const outputKey = key.includes(":") ? key : simpleName;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const inner = value as JsonObject;
      const keys = Object.keys(inner);
      if (keys.length === 1 && keys[0] === "#text") {
        result[outputKey] = inner["#text"]!;
      } else {
        result[outputKey] = simplifyValue(inner);
      }
    } else {
      result[outputKey] = value as JsonValue;
    }
  }

  return result;
}

function simplifyValue(obj: JsonObject): JsonValue {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "#text") continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const inner = value as JsonObject;
      const keys = Object.keys(inner);
      if (keys.length === 1 && keys[0] === "#text") {
        result[key] = inner["#text"]!;
      } else {
        result[key] = simplifyValue(inner);
      }
    } else {
      result[key] = value as JsonValue;
    }
  }
  return result;
}
