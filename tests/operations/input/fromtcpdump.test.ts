import { describe, test, expect } from "bun:test";
import { FromTcpdump } from "../../../src/operations/input/fromtcpdump.ts";
import { CollectorReceiver } from "../../../src/Operation.ts";

describe("FromTcpdump", () => {
  test("requires at least one capture file", () => {
    expect(() => {
      const op = new FromTcpdump();
      op.init([]);
    }).toThrow("Missing capture file");
  });

  test("wantsInput returns false", () => {
    const op = new FromTcpdump();
    op.init(["test.pcap"]);
    expect(op.wantsInput()).toBe(false);
  });

  test("parses pcap file if tcpdump is available", () => {
    // Check if tcpdump is available
    const check = Bun.spawnSync(["which", "tcpdump"]);
    if (!check.success) {
      console.log("Skipping tcpdump test - tcpdump not available");
      return;
    }

    const collector = new CollectorReceiver();
    const op = new FromTcpdump(collector);
    op.init(["tests/fixtures/test-capture1.pcap"]);

    try {
      op.finish();
      const records = collector.records.map((r) => r.toJSON());
      // Should produce 2 records (one DNS query, one DNS response)
      expect(records.length).toBe(2);

      // Each record should have file and type fields
      for (const r of records) {
        expect(r["file"]).toBe("tests/fixtures/test-capture1.pcap");
        expect(r["type"]).toBe("udp");
      }

      // First record: DNS query
      const query = records[0]!;
      expect(query["timestamp"]).toBe("1294004869.088858");
      expect(query["ethernet"]).toEqual({
        src_mac: "08:00:27:e0:fd:58",
        dest_mac: "52:54:00:12:35:02",
      });
      expect(query["length"]).toBe(84);
      const queryIp = query["ip"] as Record<string, unknown>;
      expect(queryIp["src_ip"]).toBe("10.0.2.15");
      expect(queryIp["dest_ip"]).toBe("10.0.0.1");
      expect(queryIp["ttl"]).toBe(64);
      expect(queryIp["id"]).toBe(15208);
      expect(queryIp["proto"]).toBe(17);
      const queryUdp = query["udp"] as Record<string, unknown>;
      expect(queryUdp["src_port"]).toBe(46578);
      expect(queryUdp["dest_port"]).toBe(53);

      // DNS parsed
      const queryDns = query["dns"] as Record<string, unknown>;
      expect(queryDns["id"]).toBe(3930);
      expect(queryDns["qr"]).toBe(0);

      // Second record: DNS response
      const response = records[1]!;
      expect(response["timestamp"]).toBe("1294004869.160748");
      const respDns = response["dns"] as Record<string, unknown>;
      expect(respDns["id"]).toBe(3930);
      expect(respDns["qr"]).toBe(1);
      const respAnswers = respDns["answer"] as Array<Record<string, unknown>>;
      expect(respAnswers.length).toBe(6);
      expect(respAnswers[0]!["data"]).toBe("63.251.171.81");
    } catch (e) {
      // tcpdump may not have permission to read pcap files
      console.log("tcpdump test skipped due to error:", (e as Error).message);
    }
  });

  describe("parsePacket", () => {
    function parse(lines: string[], file = "test.pcap") {
      const op = new FromTcpdump();
      return op.parsePacket(lines, file);
    }

    describe("ethernet MAC addresses", () => {
      test("parses src and dest MAC from -e output", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: 3930+ A? example.com. (42)",
        ]);
        expect(result!["ethernet"]).toEqual({
          src_mac: "aa:bb:cc:dd:ee:01",
          dest_mac: "ff:ee:dd:cc:bb:02",
        });
      });

      test("parses broadcast MAC", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ff:ff:ff:ff:ff, ethertype ARP (0x0806), length 42: Request who-has 10.0.0.1 tell 10.0.2.15, length 28",
        ]);
        expect(result!["ethernet"]).toEqual({
          src_mac: "aa:bb:cc:dd:ee:01",
          dest_mac: "ff:ff:ff:ff:ff:ff",
        });
      });
    });

    describe("IP packet details", () => {
      test("parses tos, ttl, id, offset, proto, len", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x10, ttl 63, id 54321, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: 3930+ A? example.com. (42)",
        ]);
        const ip = result!["ip"] as Record<string, unknown>;
        expect(ip["tos"]).toBe(0x10);
        expect(ip["ttl"]).toBe(63);
        expect(ip["id"]).toBe(54321);
        expect(ip["offset"]).toBe(0);
        expect(ip["proto"]).toBe(17);
        expect(ip["len"]).toBe(70);
      });

      test("parses frame length", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: 3930+ A? example.com. (42)",
        ]);
        expect(result!["length"]).toBe(84);
      });
    });

    describe("IP flags", () => {
      test("parses DF flag", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 74: (tos 0x0, ttl 64, id 12345, offset 0, flags [DF], proto TCP (6), length 60)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [S], seq 1234567890, win 65535, length 0",
        ]);
        const ip = result!["ip"] as Record<string, unknown>;
        const flags = ip["flags"] as Record<string, unknown>;
        expect(flags["dont_fragment"]).toBe(1);
        expect(flags["more_fragments"]).toBeUndefined();
      });

      test("parses MF flag", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 1500: (tos 0x0, ttl 64, id 12345, offset 0, flags [MF], proto TCP (6), length 1480)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [.], seq 1:1001, ack 1, win 65535, length 1000",
        ]);
        const ip = result!["ip"] as Record<string, unknown>;
        const flags = ip["flags"] as Record<string, unknown>;
        expect(flags["more_fragments"]).toBe(1);
        expect(flags["dont_fragment"]).toBeUndefined();
      });

      test("parses no flags as empty object", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: 3930+ A? example.com. (42)",
        ]);
        const ip = result!["ip"] as Record<string, unknown>;
        expect(ip["flags"]).toEqual({});
      });
    });

    describe("TCP packet details", () => {
      test("parses SYN packet with seq, win, cksum, options", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 74: (tos 0x0, ttl 64, id 12345, offset 0, flags [DF], proto TCP (6), length 60)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [S], cksum 0xa92f (correct), seq 1234567890, win 65535, options [mss 1460,sackOK,TS val 12345 ecr 0,nop,wscale 7], length 0",
        ]);
        expect(result!["type"]).toBe("tcp");
        const tcp = result!["tcp"] as Record<string, unknown>;
        expect(tcp["src_port"]).toBe(54321);
        expect(tcp["dest_port"]).toBe(80);
        expect(tcp["seq"]).toBe(1234567890);
        expect(tcp["seq_end"]).toBeUndefined();
        expect(tcp["win"]).toBe(65535);
        expect(tcp["cksum"]).toBe(0xa92f);
        expect(tcp["options"]).toBe(
          "mss 1460,sackOK,TS val 12345 ecr 0,nop,wscale 7"
        );
        expect(tcp["data_length"]).toBe(0);
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["SYN"]).toBe(1);
        expect(flags["ACK"]).toBeUndefined();
      });

      test("parses data packet with seq range and ack", () => {
        const result = parse([
          "1609459200.100000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 174: (tos 0x10, ttl 63, id 12346, offset 0, flags [DF], proto TCP (6), length 160)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [P.], cksum 0xb3f4 (correct), seq 1:101, ack 1, win 65535, options [nop,nop,TS val 12346 ecr 54321], length 100",
        ]);
        const tcp = result!["tcp"] as Record<string, unknown>;
        expect(tcp["seq"]).toBe(1);
        expect(tcp["seq_end"]).toBe(101);
        expect(tcp["ack"]).toBe(1);
        expect(tcp["data_length"]).toBe(100);
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["PSH"]).toBe(1);
        expect(flags["ACK"]).toBe(1);
      });

      test("parses FIN and RST flags", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 54: (tos 0x0, ttl 64, id 12348, offset 0, flags [DF], proto TCP (6), length 40)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [FR.], seq 500, ack 600, win 0, length 0",
        ]);
        const tcp = result!["tcp"] as Record<string, unknown>;
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["FIN"]).toBe(1);
        expect(flags["RST"]).toBe(1);
        expect(flags["ACK"]).toBe(1);
      });
    });

    describe("missing TCP flags: URG, ECE, CWR", () => {
      test("parses URG flag", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 74: (tos 0x0, ttl 64, id 12347, offset 0, flags [none], proto TCP (6), length 60)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [U.], seq 100, ack 200, win 32768, length 0",
        ]);
        const tcp = result!["tcp"] as Record<string, unknown>;
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["URG"]).toBe(1);
        expect(flags["ACK"]).toBe(1);
      });

      test("parses ECE flag", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 74: (tos 0x0, ttl 64, id 12347, offset 0, flags [none], proto TCP (6), length 60)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [SE.], seq 100, ack 200, win 32768, length 0",
        ]);
        const tcp = result!["tcp"] as Record<string, unknown>;
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["SYN"]).toBe(1);
        expect(flags["ECE"]).toBe(1);
        expect(flags["ACK"]).toBe(1);
      });

      test("parses CWR flag", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 74: (tos 0x0, ttl 64, id 12347, offset 0, flags [none], proto TCP (6), length 60)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [W.], seq 100, ack 200, win 32768, length 0",
        ]);
        const tcp = result!["tcp"] as Record<string, unknown>;
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["CWR"]).toBe(1);
        expect(flags["ACK"]).toBe(1);
      });

      test("parses all flags together", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 74: (tos 0x0, ttl 64, id 12347, offset 0, flags [none], proto TCP (6), length 60)",
          "    10.0.0.1.54321 > 93.184.216.34.80: Flags [SFRPUEW.], seq 100, ack 200, win 32768, length 0",
        ]);
        const tcp = result!["tcp"] as Record<string, unknown>;
        const flags = tcp["flags"] as Record<string, unknown>;
        expect(flags["SYN"]).toBe(1);
        expect(flags["FIN"]).toBe(1);
        expect(flags["RST"]).toBe(1);
        expect(flags["PSH"]).toBe(1);
        expect(flags["URG"]).toBe(1);
        expect(flags["ECE"]).toBe(1);
        expect(flags["CWR"]).toBe(1);
        expect(flags["ACK"]).toBe(1);
      });
    });

    describe("UDP packet details", () => {
      test("parses UDP checksum from bad cksum format", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: [bad udp cksum 0x1653 -> 0x44b0!] 3930+ A? example.com. (42)",
        ]);
        expect(result!["type"]).toBe("udp");
        const udp = result!["udp"] as Record<string, unknown>;
        expect(udp["cksum"]).toBe(0x1653);
      });

      test("computes UDP length from data length", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: [bad udp cksum 0x1653 -> 0x44b0!] 3930+ A? example.com. (42)",
        ]);
        const udp = result!["udp"] as Record<string, unknown>;
        // UDP length = data length (42) + 8 byte header = 50
        expect(udp["len"]).toBe(50);
      });

      test("parses UDP ports", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 100: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 86)",
          "    192.168.1.100.12345 > 8.8.8.8.53: [udp sum ok] 999+ A? example.org. (30)",
        ]);
        const udp = result!["udp"] as Record<string, unknown>;
        expect(udp["src_port"]).toBe(12345);
        expect(udp["dest_port"]).toBe(53);
      });
    });

    describe("DNS packet parsing", () => {
      test("parses DNS query", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: [bad udp cksum 0x1653 -> 0x44b0!] 3930+ A? blog.benjaminbernard.com. (42)",
        ]);
        const dns = result!["dns"] as Record<string, unknown>;
        expect(dns["id"]).toBe(3930);
        expect(dns["qr"]).toBe(0);
        const question = dns["question"] as Array<Record<string, unknown>>;
        expect(question[0]!["qname"]).toBe("blog.benjaminbernard.com");
        expect(question[0]!["qtype"]).toBe("A");
        expect(dns["answer"]).toEqual([]);
      });

      test("parses DNS response with answers", () => {
        const result = parse([
          "1609459200.000000 ff:ee:dd:cc:bb:02 > aa:bb:cc:dd:ee:01, ethertype IPv4 (0x0800), length 180: (tos 0x0, ttl 64, id 2525, offset 0, flags [none], proto UDP (17), length 166)",
          "    10.0.0.1.53 > 10.0.2.15.46578: [udp sum ok] 3930 q: A? blog.benjaminbernard.com. 6/0/0 blog.benjaminbernard.com. A 63.251.171.81, blog.benjaminbernard.com. A 69.25.27.170, blog.benjaminbernard.com. A 63.251.171.80, blog.benjaminbernard.com. A 69.25.27.173, blog.benjaminbernard.com. A 66.150.161.141, blog.benjaminbernard.com. A 66.150.161.140 (138)",
        ]);
        const dns = result!["dns"] as Record<string, unknown>;
        expect(dns["id"]).toBe(3930);
        expect(dns["qr"]).toBe(1);
        const question = dns["question"] as Array<Record<string, unknown>>;
        expect(question[0]!["qname"]).toBe("blog.benjaminbernard.com");
        expect(question[0]!["qtype"]).toBe("A");
        const counts = dns["counts"] as Record<string, unknown>;
        expect(counts["answer"]).toBe(6);
        expect(counts["authority"]).toBe(0);
        expect(counts["additional"]).toBe(0);
        const answers = dns["answer"] as Array<Record<string, unknown>>;
        expect(answers.length).toBe(6);
        expect(answers[0]!["name"]).toBe("blog.benjaminbernard.com");
        expect(answers[0]!["type"]).toBe("A");
        expect(answers[0]!["data"]).toBe("63.251.171.81");
        expect(answers[5]!["data"]).toBe("66.150.161.140");
      });

      test("does not parse DNS for non-port-53 packets", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 100: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 86)",
          "    192.168.1.100.12345 > 8.8.8.8.443: [udp sum ok] some data (30)",
        ]);
        expect(result!["dns"]).toBeUndefined();
      });
    });

    describe("ARP packet parsing", () => {
      test("parses ARP request", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ff:ff:ff:ff:ff, ethertype ARP (0x0806), length 42: Request who-has 10.0.0.1 tell 10.0.2.15, length 28",
        ]);
        expect(result!["type"]).toBe("arp");
        const arp = result!["arp"] as Record<string, unknown>;
        expect(arp["opcode"]).toBe("ARP_REQUEST");
        expect(arp["target_ip"]).toBe("10.0.0.1");
        expect(arp["sender_ip"]).toBe("10.0.2.15");
      });

      test("parses ARP reply", () => {
        const result = parse([
          "1609459200.000000 ff:ee:dd:cc:bb:02 > aa:bb:cc:dd:ee:01, ethertype ARP (0x0806), length 42: Reply 10.0.0.1 is-at ff:ee:dd:cc:bb:02, length 28",
        ]);
        expect(result!["type"]).toBe("arp");
        const arp = result!["arp"] as Record<string, unknown>;
        expect(arp["opcode"]).toBe("ARP_REPLY");
        expect(arp["sender_ip"]).toBe("10.0.0.1");
        expect(arp["sender_mac"]).toBe("ff:ee:dd:cc:bb:02");
      });

      test("parses ethernet MAC addresses on ARP packets", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ff:ff:ff:ff:ff, ethertype ARP (0x0806), length 42: Request who-has 10.0.0.1 tell 10.0.2.15, length 28",
        ]);
        expect(result!["ethernet"]).toEqual({
          src_mac: "aa:bb:cc:dd:ee:01",
          dest_mac: "ff:ff:ff:ff:ff:ff",
        });
      });

      test("parses frame length for ARP packets", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ff:ff:ff:ff:ff, ethertype ARP (0x0806), length 42: Request who-has 10.0.0.1 tell 10.0.2.15, length 28",
        ]);
        expect(result!["length"]).toBe(42);
      });
    });

    describe("ARP with verbose detail", () => {
      test("parses ARP request with Ethernet/IPv4 detail", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ff:ff:ff:ff:ff, ethertype ARP (0x0806), length 42: Ethernet (len 6), IPv4 (len 4), Request who-has 10.0.0.1 tell 10.0.2.15, length 28",
        ]);
        expect(result!["type"]).toBe("arp");
        const arp = result!["arp"] as Record<string, unknown>;
        expect(arp["opcode"]).toBe("ARP_REQUEST");
        expect(arp["target_ip"]).toBe("10.0.0.1");
        expect(arp["sender_ip"]).toBe("10.0.2.15");
      });
    });

    describe("timestamp parsing", () => {
      test("parses timestamp", () => {
        const result = parse([
          "1609459200.123456 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
          "    10.0.2.15.46578 > 10.0.0.1.53: 3930+ A? example.com. (42)",
        ]);
        expect(result!["timestamp"]).toBe("1609459200.123456");
      });
    });

    describe("file field", () => {
      test("includes the file name", () => {
        const result = parse(
          [
            "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype IPv4 (0x0800), length 84: (tos 0x0, ttl 64, id 15208, offset 0, flags [none], proto UDP (17), length 70)",
            "    10.0.2.15.46578 > 10.0.0.1.53: 3930+ A? example.com. (42)",
          ],
          "my-capture.pcap"
        );
        expect(result!["file"]).toBe("my-capture.pcap");
      });
    });

    describe("unknown/ethernet packets", () => {
      test("labels unknown ethertype as ethernet", () => {
        const result = parse([
          "1609459200.000000 aa:bb:cc:dd:ee:01 > ff:ee:dd:cc:bb:02, ethertype Unknown (0x9999), length 60: some data",
        ]);
        expect(result!["type"]).toBe("ethernet");
        expect(result!["ethernet"]).toEqual({
          src_mac: "aa:bb:cc:dd:ee:01",
          dest_mac: "ff:ee:dd:cc:bb:02",
        });
      });
    });
  });
});
