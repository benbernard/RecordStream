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
    const tcpdumpArgs = [
      "tcpdump",
      "-r",
      file,
      "-nn", // Don't resolve addresses or ports
      "-tt", // Print unformatted timestamp
      "-vv", // Very verbose (includes checksums)
      "-e", // Print link-layer header (MAC addresses)
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
    const lines = output.split("\n");

    // Group lines into packets: a new packet starts with a timestamp,
    // continuation lines start with whitespace
    const packets: string[][] = [];
    for (const line of lines) {
      if (line.trim() === "") continue;
      if (/^\d+\.\d+\s/.test(line)) {
        packets.push([line]);
      } else if (packets.length > 0) {
        packets[packets.length - 1]!.push(line);
      }
    }

    for (const packetLines of packets) {
      const record = this.parsePacket(packetLines, file);
      if (record) {
        this.pushRecord(new Record(record));
      }
    }
  }

  parsePacket(lines: string[], file: string): JsonObject | null {
    const record: JsonObject = { file };
    const headerLine = lines[0]!;

    // Combine continuation lines, filtering out hex dump lines (from -X)
    const detailLines = lines
      .slice(1)
      .filter((l) => !l.trim().startsWith("0x"))
      .map((l) => l.trim())
      .join(" ");

    // Parse timestamp
    const tsMatch = headerLine.match(/^(\d+\.\d+)\s+/);
    if (tsMatch) {
      record["timestamp"] = tsMatch[1]!;
    }

    // Parse ethernet MAC addresses from -e output
    this.parseEthernet(headerLine, record);

    // Parse frame length from ethernet header: ", length N:"
    const frameLenMatch = headerLine.match(/,\s+length\s+(\d+):/);
    if (frameLenMatch) {
      record["length"] = parseInt(frameLenMatch[1]!, 10);
    }

    // Determine packet type and parse protocol details
    if (
      headerLine.includes("ethertype IPv4") ||
      headerLine.includes("ethertype IPv6")
    ) {
      this.parseIpPacket(headerLine, detailLines, record);
    } else if (
      headerLine.includes("ethertype ARP") ||
      headerLine.includes("ARP")
    ) {
      record["type"] = "arp";
      this.parseArpDetails(headerLine + " " + detailLines, record);
    } else {
      record["type"] = "ethernet";
      // Fallback length parsing
      if (!record["length"]) {
        const lenMatch = headerLine.match(/length\s+(\d+)/);
        if (lenMatch) {
          record["length"] = parseInt(lenMatch[1]!, 10);
        }
      }
    }

    return record;
  }

  parseEthernet(line: string, record: JsonObject): void {
    // Format after timestamp: SRC_MAC > DEST_MAC, ethertype ...
    const macMatch = line.match(
      /^[\d.]+\s+([\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2})\s+>\s+([\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2}:[\da-f]{2})/i
    );
    if (macMatch) {
      record["ethernet"] = {
        src_mac: macMatch[1]!,
        dest_mac: macMatch[2]!,
      } as JsonValue;
    }
  }

  parseIpPacket(
    headerLine: string,
    detailLines: string,
    record: JsonObject
  ): void {
    const ip: JsonObject = {};

    // Parse IP header: (tos 0xN, ttl N, id N, offset N, flags [...], proto TYPE (N), length N)
    const ipHeaderMatch = headerLine.match(
      /\(tos\s+(0x[\da-f]+),\s*ttl\s+(\d+),\s*id\s+(\d+),\s*offset\s+(\d+),\s*flags\s+\[([^\]]*)\],\s*proto\s+(\w+)\s+\((\d+)\),\s*length\s+(\d+)\)/i
    );
    if (ipHeaderMatch) {
      ip["tos"] = parseInt(ipHeaderMatch[1]!, 16);
      ip["ttl"] = parseInt(ipHeaderMatch[2]!, 10);
      ip["id"] = parseInt(ipHeaderMatch[3]!, 10);
      ip["offset"] = parseInt(ipHeaderMatch[4]!, 10);
      ip["proto"] = parseInt(ipHeaderMatch[7]!, 10);
      ip["len"] = parseInt(ipHeaderMatch[8]!, 10);

      // Parse IP flags
      const flagStr = ipHeaderMatch[5]!;
      const ipFlags: JsonObject = {};
      if (flagStr.includes("DF")) ipFlags["dont_fragment"] = 1;
      if (flagStr.includes("MF")) ipFlags["more_fragments"] = 1;
      if (/\bCE\b/.test(flagStr)) ipFlags["congestion"] = 1;
      ip["flags"] = ipFlags;
    }

    // Parse IP addresses and ports from detail line
    // Format: src_ip.src_port > dest_ip.dest_port:
    const addrMatch = detailLines.match(
      /(\S+?)\.(\d+)\s+>\s+(\S+?)\.(\d+):/
    );
    if (addrMatch) {
      ip["src_ip"] = addrMatch[1]!;
      ip["dest_ip"] = addrMatch[3]!;
      const srcPort = parseInt(addrMatch[2]!, 10);
      const destPort = parseInt(addrMatch[4]!, 10);
      record["ip"] = ip as JsonValue;

      // Determine transport protocol
      if (
        headerLine.includes("proto UDP") ||
        detailLines.includes(" UDP,")
      ) {
        record["type"] = "udp";
        const udp: JsonObject = {
          src_port: srcPort,
          dest_port: destPort,
        };
        this.parseUdpDetails(detailLines, udp);
        record["udp"] = udp as JsonValue;

        if (srcPort === 53 || destPort === 53) {
          this.parseDnsDetails(detailLines, record);
        }
      } else {
        record["type"] = "tcp";
        const tcp: JsonObject = {
          src_port: srcPort,
          dest_port: destPort,
        };
        this.parseTcpDetails(detailLines, tcp);
        record["tcp"] = tcp as JsonValue;

        if (srcPort === 53 || destPort === 53) {
          this.parseDnsDetails(detailLines, record);
        }
      }
    } else {
      // IP packet without clear port info (e.g. ICMP)
      record["ip"] = ip as JsonValue;
      record["type"] = "ip";
    }
  }

  parseTcpDetails(detail: string, tcp: JsonObject): void {
    // TCP flags: Flags [S.], [P.], [SEWU.], etc.
    // S=SYN, F=FIN, R=RST, P=PSH, .=ACK, U=URG, E=ECE, W=CWR
    const flagsMatch = detail.match(/Flags\s+\[([^\]]*)\]/);
    if (flagsMatch) {
      const flagStr = flagsMatch[1]!;
      const flags: JsonObject = {};
      if (flagStr.includes("S")) flags["SYN"] = 1;
      if (flagStr.includes("F")) flags["FIN"] = 1;
      if (flagStr.includes("R")) flags["RST"] = 1;
      if (flagStr.includes("P")) flags["PSH"] = 1;
      if (flagStr.includes(".")) flags["ACK"] = 1;
      if (flagStr.includes("U")) flags["URG"] = 1;
      if (flagStr.includes("E")) flags["ECE"] = 1;
      if (flagStr.includes("W")) flags["CWR"] = 1;
      tcp["flags"] = flags;
    }

    // seq N or seq N:M
    const seqMatch = detail.match(/\bseq\s+(\d+)(?::(\d+))?/);
    if (seqMatch) {
      tcp["seq"] = parseInt(seqMatch[1]!, 10);
      if (seqMatch[2]) {
        tcp["seq_end"] = parseInt(seqMatch[2]!, 10);
      }
    }

    // ack N
    const ackMatch = detail.match(/\back\s+(\d+)/);
    if (ackMatch) {
      tcp["ack"] = parseInt(ackMatch[1]!, 10);
    }

    // win N
    const winMatch = detail.match(/\bwin\s+(\d+)/);
    if (winMatch) {
      tcp["win"] = parseInt(winMatch[1]!, 10);
    }

    // cksum 0xNNNN
    const cksumMatch = detail.match(/\bcksum\s+(0x[\da-f]+)/i);
    if (cksumMatch) {
      tcp["cksum"] = parseInt(cksumMatch[1]!, 16);
    }

    // options [...]
    const optMatch = detail.match(/\boptions\s+\[([^\]]*)\]/);
    if (optMatch) {
      tcp["options"] = optMatch[1]!;
    }

    // TCP payload length at end of line
    const lenMatch = detail.match(/\blength\s+(\d+)\s*$/);
    if (lenMatch) {
      tcp["data_length"] = parseInt(lenMatch[1]!, 10);
    }
  }

  parseUdpDetails(detail: string, udp: JsonObject): void {
    // UDP checksum: [bad udp cksum 0xNNNN -> 0xNNNN!]
    const cksumMatch = detail.match(/udp cksum\s+(0x[\da-f]+)/i);
    if (cksumMatch) {
      udp["cksum"] = parseInt(cksumMatch[1]!, 16);
    }

    // Data length from trailing (N) — UDP length = data + 8 byte header
    const dataLenMatch = detail.match(/\((\d+)\)\s*$/);
    if (dataLenMatch) {
      const dataLen = parseInt(dataLenMatch[1]!, 10);
      udp["len"] = dataLen + 8;
    }
  }

  parseDnsDetails(detail: string, record: JsonObject): void {
    const dns: JsonObject = {};

    // DNS query: ID[flags] QTYPE? QNAME. (len)
    // Example: 3930+ A? blog.benjaminbernard.com. (42)
    const queryMatch = detail.match(
      /:\s+(?:\[.*?\]\s+)?(\d+)([+*%-]*)\s+(\w+)\?\s+(\S+?)\.\s+\((\d+)\)/
    );
    if (queryMatch) {
      dns["id"] = parseInt(queryMatch[1]!, 10);
      dns["qr"] = 0;
      dns["question"] = [
        { qname: queryMatch[4]!, qtype: queryMatch[3]! },
      ] as JsonValue;
      dns["answer"] = [] as JsonValue;
      record["dns"] = dns as JsonValue;
      return;
    }

    // DNS response: ID[flags] q: QTYPE? QNAME. AN/NS/AR answers...
    // Example: 3930 q: A? blog.benjaminbernard.com. 6/0/0 blog... A 1.2.3.4, ...
    const responseMatch = detail.match(
      /:\s+(?:\[.*?\]\s+)?(\d+)([+*%-]*)\s+(?:q:\s+)?(\w+)\?\s+(\S+?)\.\s+(\d+)\/(\d+)\/(\d+)\s+(.*)/
    );
    if (responseMatch) {
      dns["id"] = parseInt(responseMatch[1]!, 10);
      dns["qr"] = 1;
      dns["question"] = [
        { qname: responseMatch[4]!, qtype: responseMatch[3]! },
      ] as JsonValue;
      dns["counts"] = {
        answer: parseInt(responseMatch[5]!, 10),
        authority: parseInt(responseMatch[6]!, 10),
        additional: parseInt(responseMatch[7]!, 10),
      } as JsonValue;
      dns["answer"] = this.parseDnsAnswers(responseMatch[8]!) as JsonValue;
      record["dns"] = dns as JsonValue;
    }
  }

  parseDnsAnswers(answersStr: string): JsonValue[] {
    const answers: JsonValue[] = [];
    // Remove trailing (len)
    const cleaned = answersStr.replace(/\s*\(\d+\)\s*$/, "");
    const parts = cleaned.split(/,\s*/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Match: name. TYPE data
      const rrMatch = trimmed.match(/^(\S+?)\.?\s+(\w+)\s+(.+)$/);
      if (rrMatch) {
        answers.push({
          name: rrMatch[1]!,
          type: rrMatch[2]!,
          data: rrMatch[3]!,
        });
      }
    }
    return answers;
  }

  parseArpDetails(text: string, record: JsonObject): void {
    const arp: JsonObject = {};

    // ARP Request: Request who-has TARGET_IP tell SENDER_IP
    const requestMatch = text.match(
      /Request\s+who-has\s+([^\s,]+)\s+tell\s+([^\s,]+)/
    );
    if (requestMatch) {
      arp["opcode"] = "ARP_REQUEST";
      arp["target_ip"] = requestMatch[1]!;
      arp["sender_ip"] = requestMatch[2]!;
      record["arp"] = arp as JsonValue;
      return;
    }

    // ARP Reply: Reply SENDER_IP is-at SENDER_MAC
    const replyMatch = text.match(/Reply\s+([^\s,]+)\s+is-at\s+([^\s,]+)/);
    if (replyMatch) {
      arp["opcode"] = "ARP_REPLY";
      arp["sender_ip"] = replyMatch[1]!;
      arp["sender_mac"] = replyMatch[2]!;
      record["arp"] = arp as JsonValue;
    }
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
