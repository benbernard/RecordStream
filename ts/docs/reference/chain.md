# chain

Run records through a sub-pipeline of recs operations, keeping everything in memory.

## Synopsis

```bash
recs chain <command> | <command> | ...
```

## Description

The `chain` command creates an in-memory pipeline of recs operations. Instead of serializing records to JSON between each step (as happens with shell pipes), `chain` passes record objects directly between operations, avoiding the overhead of repeated serialization and deserialization.

For simple two- or three-step pipelines the performance difference is negligible. For complex pipelines with many steps processing large volumes of data, the savings can be substantial. Think of `chain` as the express lane for your data.

Commands in the chain are separated by pipe characters (`|`). In most shells, you will need to escape the pipe to prevent the shell from interpreting it as a shell pipe. The backslash-pipe (`\|`) syntax is the conventional way to do this.

## Options

| Flag | Description |
|------|-------------|
| `--show-chain` | Before running the commands, print out what will happen in the chain. Useful for verifying that your escaping is correct. |
| `--dry-run` / `-n` | Do not run commands. Implies `--show-chain`. Good for checking your pipeline before committing to a long run. |

## Examples

### Parse, sort, and collate -- all in memory
```bash
recs chain recs frommultire 'data,time=(\S+) (\S+)' \| recs sort --key time=n \| recs collate --a perc,90,data
```

### Verify the chain before running
```bash
recs chain -n recs fromcsv data.csv \| recs grep 'r.status === 200' \| recs collate -a count
```

### Mix recs operations in a pipeline
```bash
recs chain recs fromcsv input.csv \| recs xform 'r.ts = Date.parse(r.date)' \| recs sort -k ts=numeric
```

## Notes

Each operation in the chain must be a registered recs operation. The chain builds the pipeline from right to left, connecting each operation's output to the next operation's input, with the final operation writing to stdout.

## See Also

- [multiplex](./multiplex) - Run operations on grouped subsets of records
- [collate](./collate) - Group and aggregate records
- [sort](./sort) - Sort records
