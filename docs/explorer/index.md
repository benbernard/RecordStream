# Explorer

Explorer is an interactive terminal UI for building RecordStream pipelines. Instead of writing shell one-liners and re-running them every time you tweak something, you build your pipeline step by step — adding stages, inspecting output, and iterating — all inside a single terminal session.

## Why Explorer?

The classic recs workflow is powerful:

```bash
recs fromcsv --header data.csv \
  | recs grep '{{status}} >= 500' \
  | recs collate --key host -a count \
  | recs sort --key count=-n \
  | recs totable
```

But exploratory data work means constant iteration — change the filter, re-run, check the output, add a sort, re-run again. With shell pipelines, every tweak means hitting up-arrow and editing a long command.

Explorer replaces that cycle with a live, interactive loop:

1. Add a stage
2. See its output instantly
3. Tweak, reorder, or delete stages
4. Export the finished pipeline as a shell script

## The Interface

Explorer uses a split-pane layout: a pipeline list on the left, a data inspector on the right.

```
+==============================================================================+
| recs explorer                 input: access.log (5000 rec)   fork: main  [?] |
+=========================+====================================================+
| Pipeline                | Inspector: grep (2847 records, cached 3s ago)      |
|                         |                                                    |
|   1 fromre       5000   | #   ip             status  time    path      size  |
|     '^(\S+)...'         | 1   192.168.1.1    200     161..   /index    1234  |
|   2 grep     +   2847   | 2   10.0.0.5       200     161..   /api/u    5678  |
|  >  status=200     <--  | 3   192.168.1.1    200     161..   /style    910   |
|   3 sort     !   ----   | 4   172.16.0.12    200     161..   /favic    234   |
|     --key time=n        | 5   10.0.0.5       200     161..   /api/d    8901  |
|   4 collate  !   ----   | 6   192.168.1.100  200     161..   /image    4567  |
|     --key host          | 7   10.0.0.22      200     161..   /js/ap    2345  |
|     -a count            | 8   172.16.0.12    200     161..   /api/c    6789  |
|   5 totable  !   ----   | 9   192.168.1.1    200     161..   /fonts    123   |
|     (output)            | 10  10.0.0.5       200     161..   /login    4560  |
|                         | ...                              (2847 total)      |
+-------------------------+----------------------------------------------------+
| a:add d:del e:edit u:undo x:export  f:fork v:vim ?:help q:quit | undo:3     |
+==============================================================================+
```

**Left panel**: Your pipeline stages, with cursor navigation. Each stage shows its operation name, arguments, cache status, and record count.

**Right panel**: The output of the currently selected stage. Move the cursor and the inspector updates immediately — cached results appear instantly, uncached stages execute on the fly.

**Status bar**: Quick-reference keybindings and undo count.

## Shell Pipelines vs Explorer

| | Shell Pipelines | Explorer |
|---|---|---|
| **Iteration** | Edit command, re-run, check output | Move cursor, see output instantly |
| **Visibility** | See one stage's output at a time | Jump between any stage to inspect |
| **Experimentation** | Copy-paste to try alternatives | Fork your pipeline into branches |
| **Undo** | Hope you remember what you had before | `u` to undo, `Ctrl+R` to redo |
| **Export** | Already a shell command | `x` to copy as shell script |
| **Sessions** | Terminal history | Named sessions, auto-saved to disk |

Explorer isn't a replacement for shell pipelines — it's where you figure out what your pipeline should be. Once you're happy, export it and drop it into a script.

## Next Steps

- **[Getting Started](./getting-started)** — Open your first file and build a pipeline
- **[Keyboard Reference](./keyboard-reference)** — Every key, organized by context
- **[Feature Guide](./features)** — Deep dives into forks, sessions, quick actions, and more
