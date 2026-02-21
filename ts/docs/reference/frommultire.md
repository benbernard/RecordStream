# frommultire

Parse lines using multiple regex patterns, accumulating fields into records.

## Synopsis

```bash
recs frommultire [options] [files...]
```

## Description

`frommultire` is the Swiss Army knife of text parsing. It matches multiple regex patterns against each line of input and accumulates the captured groups as fields in a record. When a record is "complete" (determined by flush rules), it is emitted and a new one starts. This makes it ideal for parsing multi-line log entries, configuration file blocks, and other structured text where a single record's fields are spread across multiple lines.

The core concept is the **flush**. By default, a record is flushed (emitted) when a new match would clobber an existing field -- the assumption being that if you are seeing the same field again, you must be starting a new record. You can also explicitly control flushing with `--pre-flush-regex` (flush before applying the match), `--post-flush-regex` (flush after), and `--double-flush-regex` (flush both before and after). At end-of-input, any accumulated fields are flushed as a final record.

The `--clobber` flag disables the collision-triggered flush and the EOF flush, allowing later matches to overwrite earlier ones. The `--keep-all` and `--keep` flags control which fields survive a flush, enabling patterns where some fields (like a section header) persist across multiple records.

## Options

| Flag | Description |
|------|-------------|
| `--no-flush-regex <spec>` / `--regex <spec>` / `--re <spec>` | Add a regex that does not trigger a flush on either side. This is the most common type. |
| `--pre-flush-regex <spec>` / `--pre <spec>` | Add a regex that flushes the current record *before* applying the captured fields. Use this when the matched line signals the start of a new record. |
| `--post-flush-regex <spec>` / `--post <spec>` | Add a regex that flushes the current record *after* applying the captured fields. Use this when the matched line signals the end of a record. |
| `--double-flush-regex <spec>` / `--double <spec>` | Add a regex that flushes both before and after. The matched fields form a record by themselves. |
| `--clobber` | Do not flush when a field collision would occur, and do not flush at EOF. Later matches silently overwrite earlier values. |
| `--keep-all` | Do not clear any fields when flushing. All accumulated fields carry over to the next record. |
| `--keep <fields>` | Comma-separated list of field names to preserve across flushes. Other fields are cleared. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source filename. |

### Regex Spec Syntax

Each regex spec has the form:

```
KEY1,KEY2=REGEX
```

The key names are optional. Capture groups in the regex are assigned to keys left-to-right. If no keys are provided, fields are named `N-0`, `N-1`, etc., where N is the 0-based regex index. If a key name matches `$NUM`, the corresponding capture group's value is used as the field name.

## Examples

### Parse multi-line name/address records
```bash
recs frommultire \
  --re 'fname,lname=^Name: (.*) (.*)$' \
  --re 'addr=^Address: (.*)$'
```

Given input:
```
Name: Alice Smith
Address: 123 Main St
Name: Bob Jones
Address: 456 Oak Ave
```

Produces:
```json
{"fname":"Alice","lname":"Smith","addr":"123 Main St"}
{"fname":"Bob","lname":"Jones","addr":"456 Oak Ave"}
```

### Persistent fields across records
```bash
recs frommultire \
  --post 'fname,lname=^Name: (.*) (.*)$' \
  --re 'department=^Department: (.*)$' \
  --clobber --keep department
```

Here `department` persists from record to record, while name flushes each time.

### Parse stanza-based config files
```bash
recs frommultire \
  --pre 'section=^\[(\w+)\]$' \
  --re '$1=$2=^(\w+)\s*=\s*(.*)$' \
  < config.ini
```

### Parse log entries with timestamps spanning multiple lines
```bash
recs frommultire \
  --pre 'timestamp,level=^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]' \
  --re 'message=^\s+(.*)$' \
  < application.log
```

## Notes

- Multiple regex flags can be specified and they are all tested against each line. If more than one matches, all matched fields are applied.
- Field collision detection happens per-line: if any match on a line would overwrite an existing field, the record is flushed first (unless `--clobber` is set).
- The `--keep` flag can be specified multiple times, or with comma-separated field names.

## See Also

- [fromre](./fromre) - Simpler single-regex parsing (one record per matching line)
- [fromkv](./fromkv) - For key-value pair text with consistent delimiters
- [fromapache](./fromapache) - Purpose-built Apache log parser
