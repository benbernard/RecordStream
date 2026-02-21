import { Operation, type OptionDef } from "../../Operation.ts";
import { Record } from "../../Record.ts";
import type { JsonObject, JsonValue } from "../../types/json.ts";

/**
 * Parse pcap/tcpdump capture files into records.
 *
 * This implementation shells out to `tcpdump` to parse pcap files
 * since there's no mature native pcap parser for Node/Bun.
 *
 * Analogous to App::RecordStream::Operation::fromtcpdump in Perl.
 */
export class FromTcpdump extends Operation {
  includeData = false;
  files: string[] = [];

  acceptRecord(_record: Record): boolean {
    return true;
  }

  init(args: string[]): void {
    const defs: OptionDef[] = [
      {
        long: "data",
        type: "boolean",
        handler: () => {
          this.includeData = true;
        },
        description: "Include raw data bytes of deepest packet level",
      },
    ];

    this.files = this.parseOptions(args, defs);

    if (this.files.length === 0) {
      throw new Error("Missing capture file");
    }
  }

  override wantsInput(): boolean {
    return false;
  }

  override streamDone(): void {
    for (const file of this.files) {
      this.updateCurrentFilename(file);
      this.dumpPackets(file);
    }
  }

  dumpPackets(file: string): void {
    // Use tcpdump to read pcap file and output verbose text
    const tcpdumpArgs = [
      "tcpdump",
      "-r",
      file,
      "-nn",     // Don't resolve addresses or ports
      "-tt",     // Print unformatted timestamp
      "-v",      // Verbose
      "-e",      // Print link-layer header
    ];

    if (this.includeData) {
      tcpdumpArgs.push("-X"); // Include hex dump of packet data
    }

    const result = Bun.spawnSync(tcpdumpArgs);

    if (!result.success) {
      throw new Error(
        `tcpdump failed for ${file}: ${result.stderr.toString()}`
      );
    }

    const output = result.stdout.toString();
    const lines = output.split("\n").filter((l) => l.trim() !== "");

    for (const line of lines) {
      const record = this.parsePacketLine(line, file);
      if (record) {
        this.pushRecord(new Record(record));
      }
    }
  }

  parsePacketLine(line: string, file: string): JsonObject | null {
    const record: JsonObject = { file };

    // Parse timestamp
    const tsMatch = line.match(/^(\d+\.\d+)\s+/);
    if (tsMatch) {
      record["timestamp"] = tsMatch[1]!;
    }

    // Parse basic IP info
    const ipMatch = line.match(
      /IP\s+(\S+?)\.(\d+)\s+>\s+(\S+?)\.(\d+):/
    );
    if (ipMatch) {
      record["ip"] = {
        src_ip: ipMatch[1]!,
        dest_ip: ipMatch[3]!,
      } as JsonValue;

      // Determine protocol
      if (line.includes("UDP")) {
        record["type"] = "udp";
        record["udp"] = {
          src_port: parseInt(ipMatch[2]!, 10),
          dest_port: parseInt(ipMatch[4]!, 10),
        } as JsonValue;
      } else {
        record["type"] = "tcp";
        record["tcp"] = {
          src_port: parseInt(ipMatch[2]!, 10),
          dest_port: parseInt(ipMatch[4]!, 10),
        } as JsonValue;

        // Parse TCP flags
        const flagsMatch = line.match(/Flags \[([^\]]*)\]/);
        if (flagsMatch) {
          const flagStr = flagsMatch[1]!;
          const flags: JsonObject = {};
          if (flagStr.includes("S")) flags["SYN"] = 1;
          if (flagStr.includes("F")) flags["FIN"] = 1;
          if (flagStr.includes("R")) flags["RST"] = 1;
          if (flagStr.includes("P")) flags["PSH"] = 1;
          if (flagStr.includes(".")) flags["ACK"] = 1;
          (record["tcp"] as JsonObject)["flags"] = flags;
        }
      }
    } else if (line.includes("ARP")) {
      record["type"] = "arp";
    } else {
      record["type"] = "ethernet";
    }

    // Parse length
    const lenMatch = line.match(/length\s+(\d+)/);
    if (lenMatch) {
      record["length"] = parseInt(lenMatch[1]!, 10);
    }

    return record;
  }
}

import type { CommandDoc } from "../../types/CommandDoc.ts";

export const documentation: CommandDoc = {
  name: "fromtcpdump",
  category: "input",
  synopsis: "recs fromtcpdump [options] <file1> [<file2> ...]",
  description:
    "Runs tcpdump and puts out records, one for each packet. Expects pcap files. Will put the name of the originating capture file in the 'file' field. Will parse packet types: ethernet, ip, udp, arp, tcp. The type key will indicate the highest level parsed. By default, data output is suppressed due to poor interaction with terminal programs.",
  options: [
    {
      flags: ["--data"],
      description: "Include raw data bytes of deepest packet level.",
    },
  ],
  examples: [
    {
      description: "Get records for all packets",
      command: "recs fromtcpdump capture.pcap",
    },
  ],
};
