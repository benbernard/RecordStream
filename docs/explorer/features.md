# Feature Guide

A deeper look at Explorer's features beyond the basics.

## Quick Actions

Quick actions let you build stages directly from the data you're looking at. In table view, press `h`/`l` to highlight a column, then:

- **`g`** — grep: creates a `grep` stage filtering on the highlighted field's current value
- **`s`** — sort: creates a `sort` stage ordered by the highlighted field
- **`c`** — collate: creates a `collate` stage grouping by the highlighted field with a count aggregator

Each quick action opens the edit modal so you can adjust arguments before confirming. This is the fastest way to go from "I wonder what's in this column" to a working pipeline stage.

## Field Spotlight

Press `F` on a highlighted column to open the Field Spotlight overlay. It shows the value distribution for that field across all records in the current stage's output — unique values, counts, and percentages. Useful for understanding your data before deciding what to filter or group by.

From the spotlight view, you can add stages directly based on what you see.

## Record Detail

Press `Enter` in the inspector to open a tree view of the current record. This expands nested objects and arrays for full visibility into deeply structured data. Navigate between records with arrow keys inside the detail view.

## View Modes

Press `t` in the inspector to cycle through four view modes:

| Mode | Description |
|------|-------------|
| **table** | Columnar ASCII table with column highlighting and quick actions |
| **prettyprint** | Pretty-printed JSON, one record at a time |
| **json** | Raw JSON lines |
| **schema** | Field names, inferred types, sample values, and % populated |

The schema view is particularly useful for understanding unfamiliar data — it shows you what fields exist, what types they contain, and how complete each field is across the dataset.

## Forks

Forks let you branch your pipeline to try different approaches without losing your work.

Press `f` to fork at the cursor stage. Everything up to that point is shared; the new fork gets its own stages from there on. Press `b` to switch between forks or manage them.

When you have more than one fork, a tab bar appears above the pipeline list showing all fork names.

Forks share cached results for their common prefix stages, so switching between branches is fast.

## Undo/Redo

Every structural change to your pipeline is tracked:

- Adding, deleting, editing, reordering, or toggling stages
- Creating or deleting forks
- Adding or removing input sources

Press `u` to undo, `Ctrl+R` to redo. The status bar shows the current undo depth. History is capped at 200 entries per session and persists across saves.

Undo tracks pipeline structure only — not UI state like scroll position or panel focus. This means undo restores *what you built*, not where you were looking.

## Named Sessions

Explorer auto-saves your pipeline state, undo history, and cached results to disk. Sessions are identified by the input file path by default.

Press `S` to give your session a name. Named sessions appear in the session list (`recs explorer --list`) with their name rather than just a file path.

Session management from the command line:

```bash
recs explorer --list          # Show all sessions
recs explorer --session <id>  # Resume a specific session
recs explorer --clean         # Remove sessions older than 7 days
```

When you open a file that matches an existing session, Explorer asks if you want to resume or start fresh.

## File Type Auto-Detection

Explorer detects the file type from its extension and inserts the correct `from*` stage automatically:

- `.csv` → `fromcsv --header`
- `.tsv` → `fromcsv --header --delim \t`
- `.xml` → `fromxml`
- `.jsonl` / `.json` / `.ndjson` → read directly (no stage needed)

## Caching

Explorer caches the output of each stage so navigating between stages is instant. Cache status is shown per stage in the pipeline list:

- **Cached**: results are available immediately
- **Stale**: a dependency changed; will re-execute when inspected
- **Computing**: currently executing
- **Error**: stage failed; downstream stages are greyed out

### Large file handling

When you open a file larger than 100 MB, Explorer shows a warning. Files over 1 GB prompt you to choose a cache policy:

| Policy | Behavior |
|--------|----------|
| **Cache all** | Default. Every stage's output is cached. |
| **Cache selectively** | Only stages you pin with `p` are cached. |
| **No caching** | Always re-execute from source. Lowest memory usage. |

### Selective caching

In selective mode, press `p` to pin or unpin individual stages. Only pinned stages keep their cached results; everything else re-executes on demand.

## Export Formats

Press `x` to copy your pipeline as a shell pipe script:

```bash
#!/usr/bin/env bash
recs fromcsv --header data.csv \
  | recs grep '{{status}} >= 500' \
  | recs sort --key count=-n \
  | recs totable
```

Press `X` to choose between formats:

| Format | Description |
|--------|-------------|
| **Pipe script** | Multi-line shell script with `\|` pipes (default) |
| **Chain command** | Single `recs chain` command |
| **Save to file** | Write the pipe script to a `.sh` file |

Export copies to your clipboard automatically (via OSC 52, `pbcopy`, or `xclip`).

## Vim/$EDITOR Integration

Press `v` to open the current stage's output records in your `$EDITOR`. Explorer writes the records to a temporary file, launches your editor, and resumes the TUI when you close it. Useful for detailed inspection or quick edits outside the Explorer interface.
