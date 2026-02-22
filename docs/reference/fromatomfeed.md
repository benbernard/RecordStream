# fromatomfeed

Produce records from atom feed entries.

## Synopsis

```bash
recs fromatomfeed [options] [<uris>]
```

## Description

Produce records from atom feed entries. Recs fromatomfeed will get entries from paginated atom feeds and create a record stream from the results. The keys of the record will be the fields in the atom feed entry. By default, it follows 'next' links in a feed to retrieve all entries.

## Options

| Flag | Description |
|------|-------------|
| `--follow` | Follow atom feed next links (default on). |
| `--nofollow` | Do not follow next links. |
| `--max` `<n>` | Print at most &lt;n&gt; entries and then exit. |

## Examples

### Dump an entire feed
```bash
recs fromatomfeed "http://my.xml.com"
```

### Dump just the first page of entries
```bash
recs fromatomfeed --nofollow "http://my.xml.com"
```

### Dump just the first 10 entries
```bash
recs fromatomfeed --max 10 "http://my.xml.com"
```

## See Also

- [fromxml](./fromxml)
