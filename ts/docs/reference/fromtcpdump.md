# fromtcpdump

Parse pcap capture files into records, one per packet.

## Synopsis

```bash
recs fromtcpdump [options] <file1> [file2] ...
```

## Description

`fromtcpdump` reads pcap-format packet capture files and emits one record per packet. It shells out to the system `tcpdump` command to parse the binary pcap data, so `tcpdump` must be installed and accessible on your PATH.

The command parses several protocol layers. Ethernet, IP, TCP, UDP, and ARP packets are recognized. The `type` field in each record indicates the highest-level protocol parsed. For TCP packets, flags (SYN, FIN, RST, PSH, ACK) are parsed into a structured flags object. For IP packets, source and destination addresses are extracted. Port numbers are included for TCP and UDP.

DNS information will be parsed for TCP or UDP packets that are on port 53. By default, raw packet data is suppressed to avoid flooding your terminal. Pass `--data` if you need it.

The source capture file name is stored in the `file` field of each record, which is handy when processing multiple capture files.

## Options

| Flag | Description |
|------|-------------|
| `--data` | Include raw data bytes of the deepest packet level (hex dump). Suppressed by default. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

At least one pcap file must be specified.

## Creating a Capture File

Before you can use `fromtcpdump`, you need a pcap file. Here is how to create one:

```bash
# Basic capture
sudo tcpdump -w /var/tmp/capture.pcap

# Capture with full packet data and absolute timestamps
sudo tcpdump -w capture.pcap -s4096 -S -tt

# Capture only traffic on port 80
sudo tcpdump -w http.pcap port 80
```

See `man tcpdump` for more options.

## Output Fields

| Field | Description |
|-------|-------------|
| `file` | Name of the source pcap file |
| `timestamp` | Packet timestamp (Unix epoch with fractional seconds) |
| `type` | Highest protocol parsed: `tcp`, `udp`, `arp`, or `ethernet` |
| `length` | Packet length in bytes |
| `ip.src_ip` | Source IP address (for IP packets) |
| `ip.dest_ip` | Destination IP address (for IP packets) |
| `tcp.src_port` | Source port (for TCP packets) |
| `tcp.dest_port` | Destination port (for TCP packets) |
| `tcp.flags` | TCP flags object with keys like `SYN`, `ACK`, `FIN`, etc. |
| `udp.src_port` | Source port (for UDP packets) |
| `udp.dest_port` | Destination port (for UDP packets) |

## Examples

### Parse all packets from a capture file
```bash
recs fromtcpdump capture.pcap
```

### Find all TCP SYN packets (connection initiations)
```bash
recs fromtcpdump capture.pcap \
  | recs grep '{{tcp/flags/SYN}} == 1'
```

### Count packets by protocol type
```bash
recs fromtcpdump capture.pcap \
  | recs collate --key type --aggregator count
```

### Find the top talkers by source IP
```bash
recs fromtcpdump capture.pcap \
  | recs grep '{{type}} eq "tcp" || {{type}} eq "udp"' \
  | recs collate --key ip/src_ip --aggregator count \
  | recs sort --key count=-n \
  | recs topn --n 10
```

### Process multiple capture files
```bash
recs fromtcpdump morning.pcap afternoon.pcap evening.pcap \
  | recs collate --key file --aggregator count
```

### Include packet data for forensic analysis
```bash
recs fromtcpdump --data suspicious.pcap \
  | recs grep '{{tcp/dest_port}} == 4444'
```

## Possible TCP Flags

`ACK`, `CWR`, `ECE`, `FIN`, `PSH`, `RST`, `SYN`, `URG`

## Possible IP Flags

`congestion`, `dont_fragment`, `more_fragments`

## Possible ARP Opcodes

`ARP_REPLY`, `ARP_REQUEST`, `RARP_REPLY`, `RARP_REQUEST`

## Notes

- The `tcpdump` binary must be installed on your system. On most Linux distributions it is in the `tcpdump` package; on macOS it ships with the OS.
- Reading pcap files does not require root privileges, but creating them typically does.
- Very large capture files may produce a lot of output. Consider filtering at the `tcpdump` level (e.g., `tcpdump -r file.pcap 'port 80'`) or using `recs grep` to reduce the volume.

## See Also

- [fromre](./fromre) - For parsing text-based network tool output
- [fromapache](./fromapache) - For parsing HTTP access logs (the application layer above TCP)
