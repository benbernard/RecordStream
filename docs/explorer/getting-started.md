# Getting Started with Explorer

## Opening a File

Pass a file path to `recs explorer`:

```bash
recs explorer data.csv
```

Explorer auto-detects file types by extension and inserts the appropriate input stage:

| Extension | Auto-inserted stage |
|-----------|-------------------|
| `.csv` | `fromcsv --header` |
| `.tsv` | `fromcsv --header --delim \t` |
| `.xml` | `fromxml` |
| `.jsonl`, `.json`, `.ndjson` | *(none — native format)* |

For JSONL files, Explorer reads records directly. For everything else, it adds a `from*` stage as the first step in your pipeline.

You can also launch Explorer with no arguments to see a welcome screen with your recent sessions:

```bash
recs explorer
```

## The Core Loop

Working in Explorer follows a simple pattern:

### 1. Add a stage

Press `a` to add a stage after the cursor. A categorized picker appears with fuzzy search — type a few characters to filter the 40+ available operations. Select one and you'll be prompted for its arguments.

```
+------------------------------------------------------------------+
|  Add Stage (after: fromcsv)                       [Esc] cancel    |
+------------------------------------------------------------------+
|  Search: [gre                   ]                                 |
|                                                                   |
|  TRANSFORM                       |  grep                         |
|  > grep                          |  Filter records matching      |
|                                  |  an expression.               |
|                                  |                               |
|                                  |  Options:                     |
|                                  |    -e <expr>  Filter expr     |
|                                  |                               |
|                                  |  Example:                     |
|                                  |    recs grep '{{age}} > 21'   |
+------------------------------------------------------------------+
```

### 2. Inspect the output

Move the cursor to any stage with `j`/`k` (or arrow keys). The inspector panel on the right immediately shows that stage's output — record count, field names, and data in table format.

Press `t` to cycle through view modes: **table** → **prettyprint** → **json** → **schema**.

### 3. Tweak and repeat

- `e` to edit a stage's arguments
- `Space` to toggle a stage on/off (disable without deleting)
- `d` to delete a stage
- `J`/`K` to reorder stages
- `u` to undo any change

Every structural change (add, delete, edit, reorder) is undoable. Undo history is preserved across sessions.

### 4. Export your pipeline

When you're happy with the result, press `x` to copy the pipeline as a shell script to your clipboard:

```bash
#!/usr/bin/env bash
recs fromcsv --header data.csv \
  | recs grep '{{status}} >= 500' \
  | recs collate --key host -a count \
  | recs sort --key count=-n \
  | recs totable
```

Press `X` for more export options — you can also export as a `recs chain` command or save to a file.

## Sessions

Explorer auto-saves your work. Every 30 seconds — and on every structural change — your pipeline state, undo history, and cached results are written to disk.

### Quitting and resuming

Press `q` to quit. Your session is saved automatically. Next time you open the same file, Explorer offers to resume where you left off:

```bash
recs explorer data.csv
# "Resume previous session? (5 stages, last used 2h ago)"
```

### Named sessions

Press `S` to name your session. Named sessions are easier to find in the session list.

### Session management

```bash
# List all saved sessions
recs explorer --list

# Resume a specific session by ID
recs explorer --session <id>

# Remove sessions older than 7 days
recs explorer --clean
```

## CLI Reference

```
Usage: recs explorer [options] [inputfile]

Options:
  --session, -s <id>     Resume a saved session
  --pipeline, -p <cmd>   Start with an initial pipeline command
  --list                 List saved sessions
  --clean                Remove sessions older than 7 days
  --help, -h             Show help
```

Supported file types: `.csv`, `.tsv`, `.xml`, `.jsonl`, `.json`, `.ndjson`

## Next Steps

- **[Keyboard Reference](./keyboard-reference)** — Full list of keyboard shortcuts
- **[Feature Guide](./features)** — Quick actions, forks, field spotlight, and more
