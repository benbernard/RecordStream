# NAME

App::RecordStream - recs - A system for command-line analysis of data

# SYNPOSIS

A set of programs for creating, manipulating, and outputing a stream of
Records, or JSON hashes.  Inspired by Monad.

# DESCRIPTION

The recs system consists of 3 basic sets of scripts.  Input scripts responsible
for generating streams of record objects, Manipulation scripts responsible for
analyzing, select, and manipulating records, and output scripts which take
record streams and produce output for humans.  These scripts can interface with
other systems to retrieve data, parse existing files, or just regex out some
values from a text stream.

# KEY SPECS

Many of the scripts below take key arguments to specify or assign to a key in a
record. Almost all of the places where you can specify a key (which normally
means a first level key in the record), you can instead specify a key spec.

A key spec may be nested, and may index into arrays.  Use a '/' to nest into a
hash and a '#NUM' to index into an array (i.e. #2)

An example is in order, take a record like this:

    {"biz":["a","b","c"],"foo":{"bar 1":1},"zap":"blah1"}
    {"biz":["a","b","c"],"foo":{"bar 1":2},"zap":"blah2"}
    {"biz":["a","b","c"],"foo":{"bar 1":3},"zap":"blah3"}

In this case a key spec of 'foo/bar 1' would have the values 1,2, and 3
respectively.

Similarly, 'biz/#0' would have the value of 'a' for all 3 records

You can also prefix key specs with '@' to engage the fuzzy matching logic

Matching works like this in order, first key to match wins
  1. Exact match ( eq )
  2. Prefix match ( m/^/ )
  3. Match anywehre in the key (m//)

So, in the above example '@b/#2', the 'b' portion would expand to 'biz' and 2
would be the index into the array, so all records would have the value of 'c'

Simiarly, @f/b would have values 1, 2, and 3

# SCRIPTS

## Input Generation

- recs-fromcsv

    Produces records from a csv file/stream

- recs-fromdb

    Produces records for a db table, or from a SELECT statment into a db.

- recs-fromre

    Matches input streams against a regex, puts capture groups into hashes

- recs-frommongo

    Generate a record stream from a MongoDB query.

- recs-frommultire

    Matches input streams against several regexs, puts capture groups into the record

- recs-fromsplit

    Splits input stream on a delimeter

- recs-fromps

    Generate records from the process tree

- recs-fromatomfeed

    Produces records for an optionally paginated atom feed.

- recs-fromxml

    Produces records for an XML document.

- recs-fromkv

    Produces records from input streams containing loosely formed key/value pairs

- recs-fromtcpdump

    Produces records from packet capture files (.pcap) as made by tcpdump

## Stream Manipulation

- recs-annotate

    Annotate records with common fields, will memoize additions to speed up common
    annotations

- recs-collate

    Perforce aggregation operations on records.  Group by a field, get an average,
    sum, corellation, etc.  Very powerful

- recs-delta

    Transform values into deltas between adjacent records

- recs-eval

    Eval a string of perl against each record

- recs-flatten

    Flatten records of input to one level

- recs-grep

    Select records for which a string of perl evaluates to true.

- recs-multiplex

    Take records, grouped by keys, and run a separate recs script for each group.

- recs-normalizetime

    Based on a time field, tag records with a normalized time, i.e. every 5 minute buckets

- recs-join

    Perform an inner join of two record streams.  Associate records in one stream
    with another stream.

- recs-substream

    Filter to a range of matching records with paired perl snippets --start and --end.

- recs-sort

    Sort records based on keys, may specify multiple levels of sorting, as well as
    numerical or lexical sort ordering

- recs-topn

    Outputs the top n records. You may segment the input based on a list of keys
    such that unique values of keys are treated as distinct input streams. This
    enables top n listings per value groupings.

- recs-xform

    Perform a block of perl on each record, which may modify the record, Record is
    then output

- recs-generate

    Perform a block of perl on each record to generate a record stream, which is
    then output with a chain link back to the original record.

## Output Generation

- recs-todb

    Inserts records into a DBI supported SQL database.  Will crate a local sqlite
    database by default

- recs-tocsv

    Generates correctly quoted CSV files from record streams.

- recs-tognuplot

    Create a graph of field values in a record using GNU Plot.

- recs-totable

    Pretty prints a table of results.

- recs-tohtml

    Prints out an html table of the record stream

- recs-toprettyprint

    Prettily prints records, one key to a line, great for making sense of very large records

- recs-toptable

    Prints a multi-dimensional (pivot) table of values.  Very powerful.

# NOTES

The data stream format of the recs scripts is JSON hashes separated by new
lines.  If you wish to write your own recs script in your own language, just
get a JSON parser and you should be good to go.  The recs scripts use
JSON::Syck, a fast xs-binding of a c implementation of a YAML parser/outputer

# EXAMPLES

    # look in the access log for all accesses with greater than 5 seconds, display in a table
    cat access.log | recs-fromre --fieds ip,time '^(\d+).*TIME: (\d+)' | recs-grep '$r->{time} > 5' | recs-totable

# SEE ALSO

Each of the recs-\* scripts discussed have a --help mode available to print out
usage and examples for the particular script, See that documentation for
detailed information on the operation of each of the scripts.  Also see some
other man pages:

- [recs-examples(3)](http://man.he.net/man3/recs-examples) - A set of simple recs examples
- [recs-story(3)](http://man.he.net/man3/recs-story) - A humorous introduction to RecordStream

# AUTHORS

Benjamin Bernard <perlhacker@benjaminbernard.com>

Keith Amling <keith.amling@gmail.com>

# COPYRIGHT AND LICENSE

Copyright 2007 by Benjamin Bernard and Keith Amling
This software is released under the MIT license
