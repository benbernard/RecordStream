# fromxml

Reads either from STDIN or from the specified URIs.

## Synopsis

```bash
recs fromxml [options] [<URIs>]
```

## Description

Reads either from STDIN or from the specified URIs. Parses the XML documents and creates records for the specified elements. If multiple element types are specified, will add an 'element' field to the output record.

## Options

| Flag | Description |
|------|-------------|
| `--element` `<elements>` | May be comma separated, may be specified multiple times. Sets the elements/attributes to print records for. |
| `--nested` | Search for elements at all levels of the XML document. |

## Examples

### Create records for the bar element at the top level of myXMLDoc
```bash
recs fromxml --element bar file:myXMLDoc
```

### Create records for all foo and bar elements from a URL
```bash
recs fromxml --element foo,bar --nested http://google.com
```

## See Also

- [fromatomfeed](./fromatomfeed)
