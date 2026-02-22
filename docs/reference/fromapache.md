# fromapache

Parse Apache/CLF access log lines into records.

## Synopsis

```bash
recs fromapache [options] [files...]
```

## Description

`fromapache` reads Apache HTTP server access log files and converts each line into a structured record. It understands the three most common log formats out of the box: combined, common, and vhost_common. If your web server writes logs (and it should), this command turns them into something you can actually query.

The parser operates in two modes. The default "fast" mode handles combined and common log formats and is optimized for speed -- good enough for the vast majority of real-world Apache configurations. The "strict" mode additionally supports vhost_common and can process more exotic format variations, at a modest performance cost.

Each parsed record contains fields for the remote host, user, timestamp components, HTTP request (broken into method, path, and protocol), status code, bytes transferred, and -- for combined format -- the referer and user agent strings. The request line is decomposed so you do not have to regex your way through it downstream.

## Options

| Flag | Description |
|------|-------------|
| `--fast` | Use the fast parser, which handles combined and common formats. This is the default. Cannot be used with `--strict`. |
| `--strict` | Use the strict parser, which additionally handles vhost_common and more edge cases (e.g., backslash-quoted double-quotes in fields). Slower but more thorough. Cannot be used with `--fast`. |
| `--strict '["combined","common","vhost_common"]'` | Strict mode with an explicit list of formats to try, as a JSON array. |
| `--verbose` | Enable verbose output (accepted for compatibility; no effect in TS implementation). |

## Output Fields

### Combined format

| Field | Description |
|-------|-------------|
| `rhost` | Remote hostname or IP address |
| `logname` | Remote logname (from identd; usually `-`) |
| `user` | Authenticated username (or `-`) |
| `date` | Date portion of the timestamp (e.g., `21/Feb/2026`) |
| `time` | Time portion of the timestamp (e.g., `14:32:01`) |
| `timezone` | Timezone offset (e.g., `-0500`) |
| `datetime` | Combined date, time, and timezone |
| `request` | Full HTTP request line |
| `method` | HTTP method (GET, POST, etc.) |
| `path` | Requested path |
| `proto` | HTTP protocol version (e.g., `HTTP/1.1`) |
| `status` | HTTP status code |
| `bytes` | Response size in bytes |
| `referer` | Referer header value |
| `agent` | User-Agent header value |

### Common format

Same as combined, but without the `referer` and `agent` fields.

### Vhost Common format (strict mode only)

Same as common, plus a `vhost` field containing the virtual host name.

## Examples

### Parse a standard Apache combined log
```bash
recs fromapache < /var/log/apache2/access.log
```

### Find the top 10 most-requested paths
```bash
recs fromapache access.log \
  | recs collate --key path --aggregator count \
  | recs sort --key count=-n \
  | recs topn --n 10
```

### Find all 5xx errors in the last hour's log
```bash
recs fromapache access.log \
  | recs grep '{{status}} >= 500'
```

### Use strict mode with specific formats
```bash
recs fromapache --strict '["combined","vhost_common"]' < /var/log/httpd-access.log
```

### Filter out crawler traffic (combined with user-agent inspection)
```bash
recs fromapache access.log \
  | recs grep '{{agent}} !~ /bot|crawl|spider/i'
```

## See Also

- [fromre](./fromre) - For parsing custom log formats with a regex
- [frommultire](./frommultire) - For parsing logs where fields span multiple lines
- [fromcsv](./fromcsv) - For parsing comma-separated log exports
