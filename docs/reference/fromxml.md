# fromxml

Parse XML documents into records.

## Synopsis

```bash
recs fromxml [options] [URIs...]
```

## Description

`fromxml` reads XML documents and extracts elements of specified types as records. It is the general-purpose XML parser for recs -- point it at an XML document, tell it which elements you care about, and it produces one record per matching element with the element's children and attributes as fields.

The command accepts HTTP/HTTPS URLs, `file:` URIs, and local file paths. For HTTP sources, it uses `curl` under the hood to fetch the content. XML parsing is performed using `fast-xml-parser`, which is fast and handles real-world XML well.

By default, elements are searched within the top-level children of the root element. To search at all nesting levels, pass `--nested`. When multiple element types are requested, an `element` field is added to each record so you can tell which element type produced it.

Element attributes and child elements both become fields in the output record. Text-only child elements are simplified to their text content (so `<name>Alice</name>` becomes `"Alice"` rather than `{"#text": "Alice"}`).

## Options

| Flag | Description |
|------|-------------|
| `--element <elements>` | Element names to extract records from. May be comma-separated, may be specified multiple times. |
| `--nested` | Search for matching elements at all levels of the XML document, not just top-level children. |
| `--filename-key <keyspec>` / `--fk <keyspec>` | Add a field containing the source URI or filename. |

## Examples

### Extract all "item" elements from an XML file
```bash
recs fromxml --element item file:catalog.xml
```

### Extract elements from a URL
```bash
recs fromxml --element entry --nested https://example.com/data.xml
```

### Extract multiple element types
```bash
recs fromxml --element book,author file:library.xml
```

When extracting multiple element types, each record gets an `element` field indicating which type it came from.

### Search at all nesting levels
```bash
recs fromxml --element price --nested file:products.xml
```

### Parse an RSS feed's items
```bash
recs fromxml --element item --nested https://example.com/rss.xml \
  | recs xform '{{title}} = {{title}}'
```

### Parse and filter a SOAP response
```bash
curl -s "https://api.example.com/soap" > /tmp/response.xml
recs fromxml --element Result --nested file:/tmp/response.xml \
  | recs grep '{{status}} eq "success"'
```

### Process multiple XML files
```bash
recs fromxml --element record --filename-key source file:data1.xml file:data2.xml
```

## Input XML Example

Given this XML:

```xml
<catalog>
  <book id="1">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
  </book>
  <book id="2">
    <title>1984</title>
    <author>George Orwell</author>
    <year>1949</year>
  </book>
</catalog>
```

Running:
```bash
recs fromxml --element book file:catalog.xml
```

Produces:
```json
{"id":"1","title":"The Great Gatsby","author":"F. Scott Fitzgerald","year":"1925"}
{"id":"2","title":"1984","author":"George Orwell","year":"1949"}
```

## Notes

- HTTP fetching uses `curl`, which must be available on your PATH.
- XML attributes are included as fields alongside child elements. Attribute names are not prefixed (no `@` prefix).
- Namespace prefixes in element names are handled by the parser but may appear in field names depending on the document structure.
- For Atom/RSS feeds specifically, consider using `fromatomfeed`, which understands feed pagination and entry structure out of the box.

## See Also

- [fromatomfeed](./fromatomfeed) - Specialized parser for Atom/RSS feeds with pagination support
- [fromjsonarray](./fromjsonarray) - For JSON data sources
- [fromre](./fromre) - For extracting data from XML with regexes (not recommended, but sometimes practical for simple cases)
