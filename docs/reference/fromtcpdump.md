# fromtcpdump

Runs tcpdump and puts out records, one for each packet.

## Synopsis

```bash
recs fromtcpdump [options] <file1> [<file2> ...]
```

## Description

Runs tcpdump and puts out records, one for each packet. Expects pcap files. Will put the name of the originating capture file in the 'file' field. Will parse packet types: ethernet, ip, udp, arp, tcp. The type key will indicate the highest level parsed. By default, data output is suppressed due to poor interaction with terminal programs.

## Options

| Flag | Description |
|------|-------------|
| `--data` | Include raw data bytes of deepest packet level. |

## Examples

### Get records for all packets
```bash
recs fromtcpdump capture.pcap
```
