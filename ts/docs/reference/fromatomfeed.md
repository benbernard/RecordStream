# fromatomfeed

Parse Atom and RSS feed entries into records.

## Synopsis

```bash
recs fromatomfeed [options] [uris...]
```

## Description

`fromatomfeed` fetches Atom XML feeds from one or more URIs and emits a record for each feed entry. It handles HTTP URLs, `file:` URIs, and local file paths. The record keys correspond to the fields of each Atom entry element -- title, summary, content, published date, author, and so on.

By default, the command follows pagination links. If a feed includes a `<link rel="next">` element, `fromatomfeed` will chase it and keep emitting entries until there are no more pages. This is the behavior you want for large paginated feeds. If you only want the first page, use `--nofollow`. If you want a specific number of entries regardless of pagination, use `--max`.

Feed entries are simplified during parsing: namespace prefixes are stripped from element names, nested elements with only text content are flattened to their text value, and link elements are excluded from the output (since they tend to be structural noise rather than useful data).

## Options

| Flag | Description |
|------|-------------|
| `--follow` | Follow `<link rel="next">` pagination links. This is the default. |
| `--nofollow` | Do not follow pagination links; only process the first page of each feed. |
| `--max <n>` | Emit at most `n` entries total, then stop. Useful for sampling or limiting large feeds. |

## Examples

### Dump all entries from a feed
```bash
recs fromatomfeed "https://example.com/feed.atom"
```

### Get only the first page of entries
```bash
recs fromatomfeed --nofollow "https://example.com/feed.atom"
```

### Grab the 5 most recent entries
```bash
recs fromatomfeed --max 5 "https://example.com/feed.atom"
```

### Read a local Atom file
```bash
recs fromatomfeed file:feed.xml
```

### List titles and dates from multiple feeds
```bash
recs fromatomfeed "https://blog1.com/feed" "https://blog2.com/feed" \
  | recs xform '{{title}} = {{title}}; {{published}} = {{published}}'
```

## Notes

- HTTP fetching is performed using `curl` under the hood, so the `curl` binary must be available on your system.
- If a URI fails to fetch, a warning is printed to stderr, the exit value is set to 1, and processing continues with the remaining URIs.

## See Also

- [fromxml](./fromxml) - For parsing arbitrary XML documents (not just Atom feeds)
- [fromjsonarray](./fromjsonarray) - For parsing JSON API responses
