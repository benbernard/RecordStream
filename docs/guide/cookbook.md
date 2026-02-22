# Cookbook

Real recipes for real data problems. No artificial ingredients.

## Log Analysis

### How many processes is each user running?

The classic "who's hogging the system" query:

```bash
recs fromps \
  | recs collate --key uid -a count \
  | recs sort --key count=-n \
  | recs totable
```

**Before recs:** `ps aux | awk '{print $1}' | sort | uniq -c | sort -rn` — and good luck if your usernames have spaces.

**After recs:** Clean, readable, and the output is a proper table.

### Process count by user and priority

Want a pivot table? Coming right up:

```bash
recs fromps \
  | recs collate --key uid,priority -a count \
  | recs toptable --x priority --y uid --v count
```

This gives you a 2D table with priority across the top, users down the side, and counts in each cell. Try doing *that* with `awk`.

### Find the slowest API endpoints

```bash
recs frommultire \
    --re 'latency=TIME: (\d*)' \
    --re 'method,url="([^" ]*) ([^" ?]*)' access.log \
  | recs collate -k url --perfect -a 'avg,latency' -a count \
  | recs sort -k 'avg_latency=-n' \
  | head -10 \
  | recs totable
```

Parse the access log, group by URL, compute average latency and request count, sort by slowest, take the top 10. The ancient sea wyrm of Seattle trembles before your data-fu.

### Xorg module log analysis

Which modules are logging to Xorg, and at what level?

```bash
recs frommultire \
    --re 'type,module=\((\S*)\) ([^:]+):' /var/log/Xorg.0.log \
  | recs collate --key type,module -a ct \
  | recs sort --key ct=-n \
  | recs tocsv --header
```

Output goes straight to CSV for your spreadsheet-loving colleagues.

## CSV Wrangling

### Filter and transform a CSV

```bash
recs fromcsv --header employees.csv \
  | recs grep '{{department}} === "Engineering"' \
  | recs xform '{{annual}} = {{salary}} * 12' \
  | recs sort --key annual=-n \
  | recs tocsv --header -k name,department,annual
```

### Deduplicate by email

```bash
recs fromcsv --header users.csv \
  | recs xform '{{email}} = {{email}}.toLowerCase().trim()' \
  | recs sort --key email \
  | recs collate --key email -a 'firstrec' \
  | recs tocsv --header
```

### Join two CSVs

```bash
recs fromcsv --header orders.csv \
  | recs join --key customer_id \
      <(recs fromcsv --header customers.csv) \
  | recs totable -k customer_name,order_id,amount
```

## JSON Processing

### Flatten a JSON API response

```bash
curl -s https://api.example.com/users \
  | recs fromjsonarray \
  | recs xform '{{city}} = {{address/city}}' \
  | recs totable -k name,email,city
```

### Aggregate nested data

```bash
cat events.json \
  | recs fromjsonarray \
  | recs collate --key type \
      -a count \
      -a 'avg,duration_ms' \
      -a 'perc,95,duration_ms' \
  | recs sort --key count=-n \
  | recs totable
```

### Convert JSON to CSV for spreadsheet users

```bash
cat data.json | recs fromjsonarray | recs tocsv --header > data.csv
```

Your PM just asked for the data in a spreadsheet. You didn't even have to open Python.

## Data Exploration

### Quick look at the shape of your data

```bash
recs fromcsv --header mystery-data.csv \
  | head -5 \
  | recs toprettyprint
```

### Count unique values per field

```bash
recs fromcsv --header data.csv \
  | recs collate -a 'dct,status' -a 'dct,region' -a count \
  | recs toprettyprint
```

### Find outliers

```bash
recs fromcsv --header metrics.csv \
  | recs collate -a 'avg,latency' -a 'sd,latency' \
  | recs eval '"Outlier threshold: " + ({{avg_latency}} + 3 * {{sd_latency}}).toFixed(2) + "ms"'
```

Then filter for them:

```bash
THRESHOLD=$(recs fromcsv --header metrics.csv \
  | recs collate -a 'avg,latency' -a 'sd,latency' \
  | recs eval '{{avg_latency}} + 3 * {{sd_latency}}')

recs fromcsv --header metrics.csv \
  | recs grep "{{latency}} > $THRESHOLD" \
  | recs totable
```

## XML and Structured Data

### Parse XML configuration

```bash
recs fromxml config.xml \
  | recs grep '{{enabled}} === "true"' \
  | recs totable -k name,value
```

### Extract data from key-value logs

```bash
recs fromkv --delim '=' < app.properties \
  | recs grep '{{key}}.startsWith("db.")' \
  | recs totable
```

## Pipeline Patterns

### The "Top N" pattern

```bash
recs fromcsv --header data.csv \
  | recs sort --key score=-n \
  | recs topn --key score -n 10 \
  | recs totable
```

### The "Group and Rank" pattern

```bash
recs fromcsv --header sales.csv \
  | recs collate --key region -a 'sum,revenue' -a count \
  | recs sort --key sum_revenue=-n \
  | recs xform '{{rank}} = $line' \
  | recs totable
```

### The "Delta" pattern

See how values change between records:

```bash
recs fromcsv --header timeseries.csv \
  | recs sort --key timestamp \
  | recs delta --key value \
  | recs totable -k timestamp,value,value_delta
```

### The "Annotate" pattern

Add running statistics to each record:

```bash
recs fromcsv --header data.csv \
  | recs annotate -k category -a 'count' -a 'avg,score' \
  | recs totable
```

Each record gets the current running count and average for its category — no separate aggregation step needed.
