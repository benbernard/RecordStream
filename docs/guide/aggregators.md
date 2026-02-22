# Aggregators

Aggregators are the statistical powerhouse of recs. Used primarily with `collate`, they compute summary values across groups of records — counts, sums, averages, percentiles, and much more.

## How Aggregators Work

The `collate` command groups records by key fields and applies aggregators to each group. Each aggregator produces one output field per group:

```bash
# Group by department, compute count and average salary
recs collate --key department -a count -a 'avg,salary'
```

Input:
```json
{"department": "Engineering", "salary": 120000}
{"department": "Engineering", "salary": 130000}
{"department": "Marketing", "salary": 90000}
{"department": "Marketing", "salary": 95000}
```

Output:
```json
{"department": "Engineering", "count": 2, "avg_salary": 125000}
{"department": "Marketing", "count": 2, "avg_salary": 92500}
```

## Aggregator Syntax

Aggregators are specified with the `-a` flag:

```
-a aggregator_name[,field][,output_name]
```

- **aggregator_name** — Which aggregator to use (e.g., `sum`, `avg`, `count`)
- **field** — Which field to aggregate (not needed for `count`)
- **output_name** — Custom name for the output field (optional)

```bash
# Default output name: "sum_salary"
recs collate -a 'sum,salary'

# Custom output name: "total_pay"
recs collate -a 'sum,salary,total_pay'
```

## Complete Aggregator Reference

### Counting & Existence

| Aggregator | Syntax | Description |
|-----------|--------|-------------|
| **count** | `-a count` | Count records in each group |
| **distinctcount** | `-a 'dct,field'` | Count distinct values of a field |
| **counttrue** | `-a 'ct,field'` | Count records where field is truthy |

### Numeric

| Aggregator | Syntax | Description |
|-----------|--------|-------------|
| **sum** | `-a 'sum,field'` | Sum values of a field |
| **average** | `-a 'avg,field'` | Average (mean) of a field |
| **min** | `-a 'min,field'` | Minimum value |
| **max** | `-a 'max,field'` | Maximum value |
| **variance** | `-a 'var,field'` | Population variance |
| **stddev** | `-a 'sd,field'` | Population standard deviation |
| **percentile** | `-a 'perc,NN,field'` | Nth percentile value |
| **linearregression** | `-a 'linreg,x_field,y_field'` | Linear regression (slope, intercept, R²) |
| **correlation** | `-a 'corr,x_field,y_field'` | Pearson correlation coefficient |

### Selection

| Aggregator | Syntax | Description |
|-----------|--------|-------------|
| **first** | `-a 'first,field'` | First value seen |
| **last** | `-a 'last,field'` | Last value seen |
| **firstrecord** | `-a firstrec` | The entire first record |
| **lastrecord** | `-a lastrec` | The entire last record |
| **mode** | `-a 'mode,field'` | Most common value |

### Collection

| Aggregator | Syntax | Description |
|-----------|--------|-------------|
| **distinct** | `-a 'distinct,field'` | Array of distinct values |
| **concat** | `-a 'concat,field,delim'` | Concatenate values with delimiter |
| **array** | `-a 'array,field'` | Collect all values into an array |
| **records** | `-a records` | Collect all records into an array |

### Advanced

| Aggregator | Syntax | Description |
|-----------|--------|-------------|
| **covariance** | `-a 'cov,x_field,y_field'` | Covariance of two fields |
| **maxrec** | `-a 'maxrec,field'` | Record with the maximum value of field |
| **minrec** | `-a 'minrec,field'` | Record with the minimum value of field |

## Multiple Aggregators

You can apply as many aggregators as you want to the same group:

```bash
recs collate --key department \
  -a count \
  -a 'avg,salary' \
  -a 'min,salary' \
  -a 'max,salary' \
  -a 'perc,90,salary'
```

## The Domain Language

For more complex aggregations, collate supports an inline domain language using `-e`:

```bash
# Compute ratio in a single expression
recs collate -e '{{ratio}} = sum({{errors}}) / sum({{requests}})'

# Conditional counting
recs collate --key host -e '{{error_rate}} = ct({{status}} >= 500) / count()'
```

The domain language lets you compose aggregators with arithmetic and build computed fields that would otherwise require multiple passes.

Available functions in the domain language match the aggregator names:
- `count()`, `sum(expr)`, `avg(expr)`, `min(expr)`, `max(expr)`
- `ct(expr)` (count where true), `dct(expr)` (distinct count)
- `perc(N, expr)`, `first(expr)`, `last(expr)`, `mode(expr)`
- `concat(expr, delim)`, `distinct(expr)`

## Examples

### Top departments by headcount

```bash
recs fromcsv --header employees.csv \
  | recs collate --key department -a count \
  | recs sort --key count=-n \
  | recs totable
```

### Latency percentiles per endpoint

```bash
recs fromjsonarray < requests.json \
  | recs collate --key endpoint \
      -a 'perc,50,latency_ms' \
      -a 'perc,95,latency_ms' \
      -a 'perc,99,latency_ms' \
      -a count \
  | recs sort --key count=-n \
  | recs totable
```

### Error rates by service

```bash
recs fromjsonarray < logs.json \
  | recs collate --key service \
      -a count \
      -a 'ct,is_error' \
  | recs xform '{{error_rate}} = ({{ct_is_error}} / {{count}} * 100).toFixed(1) + "%"' \
  | recs sort --key ct_is_error=-n \
  | recs totable -k service,count,ct_is_error,error_rate
```
