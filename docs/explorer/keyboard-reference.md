# Keyboard Reference

All keyboard shortcuts in Explorer, organized by context. Press `?` at any time to see this reference inside the app.

## Pipeline Panel (left)

These keys are active when the pipeline list has focus.

| Key | Action |
|-----|--------|
| `↑` / `k` | Move cursor up |
| `↓` / `j` | Move cursor down |
| `a` | Add stage after cursor |
| `A` | Add stage before cursor |
| `d` | Delete stage (with confirmation) |
| `e` | Edit stage arguments |
| `Space` | Toggle stage enabled/disabled |
| `J` | Reorder stage down |
| `K` | Reorder stage up |
| `r` | Re-run from cursor stage (invalidate cache) |
| `Enter` / `Tab` | Focus inspector panel |

## Inspector Panel (right)

These keys are active when the inspector has focus.

| Key | Action |
|-----|--------|
| `↑` / `k` | Scroll records up |
| `↓` / `j` | Scroll records down |
| `t` | Cycle view mode: table → prettyprint → json → schema |
| `←` / `h` | Move column highlight left (table view) |
| `→` / `l` | Move column highlight right (table view) |
| `Enter` | Open record detail (tree view) |
| `Esc` | Clear column highlight, or return focus to pipeline |

## Quick Actions

When a column is highlighted in table view (navigate with `h`/`l`), these one-key shortcuts create a new stage targeting the highlighted field:

| Key | Action |
|-----|--------|
| `g` | Add **grep** stage filtering on the highlighted field |
| `s` | Add **sort** stage sorting by the highlighted field |
| `c` | Add **collate** stage grouping by the highlighted field (with count) |
| `F` | Open **Field Spotlight** — value distribution for the highlighted field |

After pressing `g`, `s`, or `c`, the edit modal opens so you can fine-tune the stage arguments before confirming.

## Global

These keys work regardless of which panel is focused.

| Key | Action |
|-----|--------|
| `Tab` | Toggle focus between pipeline and inspector |
| `u` | Undo last pipeline edit |
| `Ctrl+R` | Redo last undone edit |
| `v` | Open current stage's records in `$EDITOR` |
| `x` | Export pipeline as shell script → clipboard |
| `X` | Export pipeline (choose format) |
| `S` | Save/rename session |
| `f` | Fork pipeline at cursor stage |
| `b` | Switch/manage forks |
| `i` | Switch input source |
| `p` | Pin/unpin stage for selective caching |
| `?` | Toggle help panel |
| `q` / `Ctrl+C` | Quit (auto-saves session) |
