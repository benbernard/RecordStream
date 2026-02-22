# Examples

A set of simple recs examples to get you up and running. These are meant as a
learning tool for folks new to recs. For a humorous introduction, see the
[Story](/guide/story).

## How many processes is each user on my system running?

```bash
recs fromps \
  | recs collate --key uid -a count \
  | recs sort --key count=n \
  | recs totable
```

Broken down:

1. **`recs fromps`** — Get records of all the processes currently running.

2. **`recs collate --key uid -a count`** — Grouping by the `uid` field, count
   how many records fall into each group (stored in the `count` field by
   default).

3. **`recs sort --key count=n`** — Sort the resulting records by the `count`
   field numerically (rather than lexically).

4. **`recs totable`** — Print the output in a nicely formatted plain text table.

## How many processes for each user at each priority level?

```bash
recs fromps \
  | recs collate --key uid,priority -a count \
  | recs toptable --x priority --y uid --v count
```

Broken down:

1. **`recs fromps`** — Get records of all the processes currently running.

2. **`recs collate --key uid,priority -a count`** — Grouping by the `uid` and
   the `priority` field, count how many records fall into each group.

3. **`recs toptable --x priority --y uid -v count`** — Create a 2-dimensional
   table (a *pivot table*): across the top put the priority values, down the
   side put the uid, in each cell put the value of the count field for that
   priority/uid combination.

## Prep a report on number of modules logging to Xorg.log

What Xorg modules put information in my Xorg.log at startup, and what log level
are they logged at? I need this in CSV format for importing into a spreadsheet
program.

```bash
recs frommultire \
    --re 'type,module=\((\S*)\) ([^:]+):' /var/log/Xorg.0.log \
  | recs collate --key type,module -a ct \
  | recs sort --key ct=n \
  | recs tocsv --header
```

Broken down:

1. **`recs frommultire --re 'type,module=\((\S*)\) ([^:]+):' /var/log/Xorg.0.log`**
   — Parse out the `type` and `module` from the Xorg log file. That regex
   captures non-whitespace inside a literal `()` pair, then captures text after
   a space up to the first `:` (colon).

2. **`recs collate --key type,module -a ct`** — Collate records into groups of
   type-modules, and count how many in each group across all records.

3. **`recs sort --key ct=n`** — Sort by the count, numerically.

4. **`recs tocsv --header`** — Output a table in spreadsheet format (no ASCII
   art), delimited by commas.

## See Also

- See [Getting Started](/guide/getting-started) for an overview of the system
- See [Story](/guide/story) for a humorous introduction to RecordStream
- See [Cookbook](/guide/cookbook) for more advanced recipes
