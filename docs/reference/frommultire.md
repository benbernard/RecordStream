# frommultire

Match multiple regexes against each line of input (or lines of &lt;files&gt;).

## Synopsis

```bash
recs frommultire [options] [<files>]
```

## Description

Match multiple regexes against each line of input (or lines of &lt;files&gt;). Various parameters control when the accumulated fields are flushed to output as a record and which, if any, fields are cleared when the record is flushed. By default regexes do not necessarily flush on either side, would-be field collisions cause a flush, EOF causes a flush if any fields are set, and all fields are cleared on a flush. Regex syntax is: '&lt;KEY1&gt;,&lt;KEY2&gt;=REGEX'. KEY field names are optional. If a field matches $NUM, then that match number in the regex will be used as the field name.

## Options

| Flag | Description |
|------|-------------|
| `--no-flush-regex` / `--regex` / `--re` `<regex>` | Add a normal regex (no flushing). |
| `--pre-flush-regex` / `--pre` `<regex>` | Add a regex that flushes before interpreting fields when matched. |
| `--post-flush-regex` / `--post` `<regex>` | Add a regex that flushes after interpreting fields when matched. |
| `--double-flush-regex` / `--double` `<regex>` | Add a regex that flushes both before and after interpreting fields when matched. |
| `--clobber` | Do not flush records when a field from a match would clobber an already existing field and do not flush at EOF. |
| `--keep-all` | Do not clear any fields on a flush. |
| `--keep` `<fields>` | Do not clear this comma separated list of fields on a flush. |

## Examples

### Parse several fields on separate lines
```bash
recs frommultire --re 'fname,lname=^Name: (.*) (.*)$' --re 'addr=^Address: (.*)$'
```

### Some fields apply to multiple records (department here)
```bash
recs frommultire --post 'fname,lname=^Name: (.*) (.*)$' --re 'department=^Department: (.*)$' --clobber --keep team
```

## See Also

- [fromre](./fromre)
