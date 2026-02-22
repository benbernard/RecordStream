---
layout: home
hero:
  name: RecordStream
  text: Your data's new best friend
  tagline: A toolkit for taming JSON streams with Unix pipes — because your data called, and it wants to be transformed.
  image:
    src: /logo-hero.png
    alt: RecordStream
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Command Reference
      link: /reference/
features:
  - title: Pipe All the Things
    details: Compose powerful data pipelines from small, focused commands. Each record is one JSON object per line — Unix philosophy meets structured data.
  - title: Snippets That Speak Your Language
    details: Write inline JavaScript (or Python) expressions to transform, filter, and evaluate records on the fly. No boilerplate required.
  - title: Batteries Included
    details: 40+ commands for input, transformation, and output. Parse CSV, XML, Apache logs, key-value pairs, and more — then sort, collate, join, and render.
---

## See It in Action

Got a CSV? Turn it into insights in three lines:

```bash
# Who's spending the most? Let's find out.
recs fromcsv --header purchases.csv          \
  | recs collate --key customer -a sum,amount \
  | recs sort --key amount=-n                 \
  | recs totable
```

```
customer   sum_amount
--------   ----------
Alice      9402.50
Bob        7281.00
Charlie    3104.75
```

Or maybe you've got some JSON and you need answers *now*:

```bash
cat api-response.json                       \
  | recs fromjsonarray                      \
  | recs grep '{{status}} === "active"'     \
  | recs xform '{{age}} = {{age}} + 1'      \
  | recs totable -k name,status,age
```

## Install

```bash
# One-liner (macOS / Linux)
curl -fsSL https://raw.githubusercontent.com/benbernard/RecordStream/master/install.sh | bash
```

That detects your platform, downloads the right binary, and puts it in your `$PATH`. Updates happen automatically — recs checks for new versions in the background and tells you when one is available. Run `recs --update` to upgrade in place.

## Philosophy

RecordStream is built on a simple idea: **one JSON object per line**. Every command reads records from stdin, does something useful, and writes records to stdout. Chain them with pipes and you've got a data pipeline that would make a shell wizard weep with joy.

**Input** commands create records from the outside world — CSV files, databases, XML, Apache logs, you name it.

**Transform** commands reshape, filter, sort, collate, and generally boss your data around.

**Output** commands turn records into something humans can read — tables, CSV, HTML, pretty-printed JSON.

The result? Complex data transformations expressed as readable, composable, debuggable pipelines. No Spark cluster required.
