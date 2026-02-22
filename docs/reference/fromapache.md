# fromapache

Each line of input (or lines of &lt;files&gt;) is parsed to produce an output record from Apache access logs.

## Synopsis

```bash
recs fromapache [options] [files...]
```

## Description

Each line of input (or lines of &lt;files&gt;) is parsed to produce an output record from Apache access logs. Supports combined, common, and vhost_common log formats.

## Options

| Flag | Description |
|------|-------------|
| `--fast` | Use the fast parser which works relatively fast. It can process only 'common', 'combined' and custom styles with compatibility with 'common', and cannot work with backslash-quoted double-quotes in fields. This is the default. |
| `--strict` | Use the strict parser which works relatively slow. It can process any style format logs, with specification about separator, and checker for perfection. It can also process backslash-quoted double-quotes properly. |
| `--verbose` | Verbose output. |

## Examples

### Get records from typical apache log
```bash
recs fromapache < /var/log/httpd-access.log
```

### Use strict parser with specific formats
```bash
recs fromapache --strict '["combined","common","vhost_common"]' < /var/log/httpd-access.log
```

## See Also

- [fromre](./fromre)
- [frommultire](./frommultire)
