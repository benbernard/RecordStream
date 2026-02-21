/**
 * Help topic text for --help-* flags.
 * Each topic corresponds to a help type that operations can opt into.
 */

export function snippetHelp(): string {
  return `CODE SNIPPETS:
  Recs code snippets are JavaScript code with a few predefined variables
  and special syntax to assist in accessing record fields.

Special Variables:
  r         - The current Record object. Use r.fieldName or r.get("field")
              to read fields, r.set("field", value) to set them.

  line      - The number of records processed so far, starting at 1.
              For most scripts this corresponds to the line number of input.

  filename  - The filename of the originating record. Only useful if passing
              filenames directly to the recs script; piping from other recs
              scripts will show "NONE".

Special Syntax:
  Use {{search_string}} to access record fields. Use / to nest into
  sub-objects. Use #N to index into arrays. Prefix with @ for fuzzy
  matching.

  This is the same as a key spec prefaced with @. See --help-keyspecs
  for more details.

  Examples with a record like:
    { "foo": { "bar 1": 1 }, "zoo": 2 }

    {{zoo}}             // value of zoo (2)
    {{foo/bar 1}}       // value of foo["bar 1"] (1)
    {{foo}} = 1         // set the "foo" key to value 1
    {{new/arr/#0}} = 3  // auto-vivify nested structure
    {{arr/#3}}          // index 3 of the array under "arr"
`;
}

export function keyspecsHelp(): string {
  return `KEY SPECS:
  A key spec is a short way of specifying a field with prefixes or regular
  expressions. It may also be nested into objects and arrays. Use a '/' to
  nest into an object and '#NUM' to index into an array (e.g. #2).

  Example with records like:
    {"biz":["a","b","c"],"foo":{"bar 1":1},"zap":"blah1"}
    {"biz":["a","b","c"],"foo":{"bar 1":2},"zap":"blah2"}

  A key spec of 'foo/bar 1' yields values 1, 2 from the respective records.
  A key spec of 'biz/#0' yields 'a' for all records.

  Prefix key specs with '@' to enable fuzzy matching:

  Fuzzy matching order (first match wins):
    1. Exact match
    2. Prefix match
    3. Substring match anywhere in the key

  So '@b/#2' expands 'b' to 'biz', giving value 'c' for all records.
  And '@f/b' expands to 'foo/bar 1', giving values 1, 2.

  To include a literal '/' in a key name, escape it: foo\\/bar
`;
}

export function keygroupsHelp(): string {
  return `KEY GROUPS:
  Syntax: !regex!opt1!opt2...

  Key groups specify multiple fields with a single argument using regexes.
  By default, the regex matches against all first-level keys of a record.

  Example with a record:
    { "zip": 1, "zap": 2, "foo": { "bar": 3 } }

  Key group !z! matches keys 'zip' and 'zap'.

  You can include a literal '!' in the regex by escaping it with \\.

  Normally, key groups only match keys whose values are scalars (not objects
  or arrays). Use the 'returnrefs' flag to also match reference values.

  With the above record, !f! matches no fields, but !f!rr matches 'foo'.

  Options:
    returnrefs, rr   - Return keys that have reference values (default: off)
    full, f          - Match regex against full key paths (recurse fully)
    depth=NUM, d=NUM - Only match keys at NUM depth (regex matches full path)
    sort, s          - Sort keyspecs lexically
`;
}

export function keysHelp(): string {
  return keyspecsHelp() + "\n" + keygroupsHelp();
}

export function domainLanguageHelp(): string {
  return `DOMAIN LANGUAGE:
  The domain language allows creation of aggregators and valuations
  programmatically using JavaScript expressions. All standard aggregators
  are available as constructor functions.

  Below are the built-in functions:

Function Library:
  ii_agg(<initial>, <combine>[, <squish>])
  inject_into_aggregator(<initial>, <combine>[, <squish>])
    Create an ad-hoc aggregator using inject-into. The initial expression
    returns the starting accumulator value. The combine expression uses
    $a (accumulator) and $r (record) and returns the new accumulator.
    The optional squish expression uses $a for the final transformation.

    Example:
      ii_agg("[0, 0]", "[$a[0] + 1, $a[1] + {{ct}}]", "$a[1] / $a[0]")

  mr_agg(<map>, <reduce>[, <squish>])
  map_reduce_aggregator(<map>, <reduce>[, <squish>])
    Create an ad-hoc aggregator using map-reduce. The map expression takes
    $r (record) and returns a mapped value. The reduce expression takes $a
    and $b and combines two mapped values. The optional squish expression
    takes $a for the final transformation.

    Example:
      mr_agg("[1, {{ct}}]", "[$a[0]+$b[0], $a[1]+$b[1]]", "$a[1]/$a[0]")

  rec() / record()
    A valuation that returns the entire record.

  snip(<snippet>)
    Takes a snippet string and returns it as a valuation. Used to
    distinguish snippets from scalars, e.g. min(snip('{{x}}'))

  subset_agg(<predicate>, <aggregator>)
    Filter records through a predicate before aggregating.

    Example:
      subset_agg("{{time_ms}} <= 6000", ct())

  val(<function>) / valuation(<function>)
    Takes a function, creates a valuation from it.

  xform(<aggregator>, <snippet>)
    Apply a transformation to an aggregator's result.

    Example:
      xform(recs(), "{{1/time}} - {{0/time}}")

  Standard aggregators are also available as functions:
    sum, count/ct, average/avg, min, max, first, last, percentile/perc,
    mode, records/recs, array/arr, concat/concatenate,
    uconcat/unique_concatenate, uniq_array/unique_array, count_by/countby,
    distinct_count/dcount, values_to_keys/valstok, firstrec, lastrec,
    recformax, recformin, variance/var, standard_deviation/stddev,
    correlation/corr, linear_regression/linreg, covariance/covar,
    percentile_map/percmap
`;
}

export function clumpingHelp(): string {
  return `CLUMPING:
  "Clumping" defines a way of taking a stream of input records and
  rearranging them into groups for processing. The most common use is
  grouping records for aggregation by collate, and the most common
  clumpers are those specified by collate's normal options.

  Key-based clumping options:
    --key, -k <keyspec>    Group by one or more key fields
    --adjacent             Only group adjacent records (LRU size 1)
    --size, -n <N>         Keep N running clumps (LRU eviction)
    --cube                 Generate all key combinations with "ALL"
    --dlkey <name>=<expr>  Domain language key (JS expression as valuation)

  The --adjacent flag is equivalent to --size 1 and is useful when records
  are already sorted by the grouping key; it avoids spooling all records
  into memory.

  Cube mode outputs 2^(number of key fields) records per clump, with every
  combination of fields replaced with "ALL". Not meant for use with
  --adjacent or --size.

Examples:
  Group adjacent records for each host and count them:
    recs collate -c keylru,host,1 -a ct
  Output successive differences of the time field:
    recs collate -c window,2 --dla 'time_delta=xform(recs(), "{{#1/time}} - {{#0/time}}")'
`;
}
