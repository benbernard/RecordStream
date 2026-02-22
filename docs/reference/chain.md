# chain

Creates an in-memory chain of recs operations.

## Synopsis

```bash
recs chain <command> | <command> | ...
```

## Description

Creates an in-memory chain of recs operations. This avoids serialization and deserialization of records at each step in a complex recs pipeline. Arguments are specified on the command line separated by pipes. For most shells, you will need to escape the pipe character to avoid having the shell interpret it as a shell pipe.

## Options

| Flag | Description |
|------|-------------|
| `--show-chain` | Before running the commands, print out what will happen in the chain. |
| `--dry-run` / `-n` | Do not run commands. Implies --show-chain. |

## Examples

### Parse some fields, sort and collate, all in memory
```bash
recs chain recs-frommultire 'data,time=(\S+) (\S+)' \| recs-sort --key time=n \| recs-collate --a perc,90,data
```

### Use shell commands in your recs stream
```bash
recs chain recs-frommultire 'data,time=(\S+) (\S+)' \| recs-sort --key time=n \| grep foo \| recs-collate --a perc,90,data
```

## See Also

- [collate](./collate)
- [sort](./sort)
- [xform](./xform)
