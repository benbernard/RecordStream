[![Build Status](https://travis-ci.org/benbernard/RecordStream.svg?branch=master)](https://travis-ci.org/benbernard/RecordStream.svg?branch=master)

# NAME

App::RecordStream - recs - A system for command-line analysis of data. 

# SYNOPSIS

A set of programs for creating, manipulating, and outputing a stream of
Records, or JSON hashes.  Inspired by Monad.

# INSTALLATION

## Quick, standalone bundle

The quickest way to start using recs is via the minimal, standalone bundle:

    curl -fsSL https://recs.pl > recs
    chmod +x recs
    ./recs --help

This is also known as the "fatpacked" recs.

## From CPAN

You can also install recs from [CPAN](http://cpan.org) as App::RecordStream:

    cpanm --interactive App::RecordStream

Using [cpanm](https://metacpan.org/pod/cpanm) in interactive mode will prompt you for optional feature
support.  Other CPAN clients such as [cpan](https://metacpan.org/pod/cpan) and [cpanp](https://metacpan.org/pod/cpanp) also work fine, but
you can't opt to use any optional features (just like cpanm in non-interactive
mode).  A kitchen-sink install of App::RecordStream looks like:

    cpanm --with-recommends --with-all-features App::RecordStream

If you don't have [cpanm](https://metacpan.org/pod/cpanm) itself, you can install it easily with:

    curl -fsSL https://cpanmin.us | perl - App::cpanminus

# DESCRIPTION

The recs system consists of three basic sets of commands:

- _Input_ commands responsible for generating streams of record objects
- _Manipulation_ commands responsible for analyzing, selecting, and manipulating records
- _Output_ commands responsible for taking record streams and producing output for humans or other programs

These commands can interface with other systems to retrieve data, parse existing
files, or just regex out some values from a text stream.

Commands are run using `recs command [options and arguments]`.  If you're using
a CPAN-based install, you may also run commands directly as `recs-command`,
though this is no longer recommended for forwards compatibility.  Both
[installation methods](#installation) provide a top-level `recs` executable
which dispatches to commands, so this is the preferred invocation style.

The core recs commands are briefly summarized below, and you can list all
available commands by running `recs --list`.

To read more about each command, run `recs command --help`.  Longer
documentation is available as `recs command --help-all` or `perldoc recs-command`.
For example, to read more about ["fromcsv"](#fromcsv), you might run any of the
following:

    recs fromcsv --help
    recs fromcsv --help-all
    perldoc recs-fromcsv

# COMMANDS

## Input Generation

- fromcsv

    Produces records from a csv file/stream

- fromdb

    Produces records for a db table, or from a SELECT statment into a db.

- fromre

    Matches input streams against a regex, puts capture groups into hashes

- frommongo

    Generate a record stream from a MongoDB query.

- frommultire

    Matches input streams against several regexs, puts capture groups into the record

- fromsplit

    Splits input stream on a delimeter

- fromps

    Generate records from the process tree

- fromatomfeed

    Produces records for an optionally paginated atom feed.

- fromxml

    Produces records for an XML document.

- fromkv

    Produces records from input streams containing loosely formed key/value pairs

- fromtcpdump

    Produces records from packet capture files (.pcap) as made by tcpdump

## Stream Manipulation

- annotate

    Annotate records with common fields, will memoize additions to speed up common
    annotations

- collate

    Perforce aggregation operations on records.  Group by a field, get an average,
    sum, corellation, etc.  Very powerful

- delta

    Transform values into deltas between adjacent records

- eval

    Eval a string of perl against each record

- flatten

    Flatten records of input to one level

- grep

    Select records for which a string of perl evaluates to true.

- multiplex

    Take records, grouped by keys, and run a separate recs command for each group.

- normalizetime

    Based on a time field, tag records with a normalized time, i.e. every 5 minute buckets

- join

    Perform an inner join of two record streams.  Associate records in one stream
    with another stream.

- substream

    Filter to a range of matching records with paired Perl snippets `--start` and `--end`.

- sort

    Sort records based on keys, may specify multiple levels of sorting, as well as
    numerical or lexical sort ordering

- topn

    Outputs the top _n_ records. You may segment the input based on a list of keys
    such that unique values of keys are treated as distinct input streams. This
    enables top _n_ listings per value groupings.

- xform

    Perform a block of perl on each record, which may modify the record, Record is
    then output

- generate

    Perform a block of perl on each record to generate a record stream, which is
    then output with a chain link back to the original record.

## Output Generation

- todb

    Inserts records into a DBI supported SQL database.  Will create a local sqlite
    database by default

- tocsv

    Generates correctly quoted CSV files from record streams.

- tognuplot

    Create a graph of field values in a record using GNU Plot.

- totable

    Pretty prints a table of results.

- tohtml

    Prints out an html table of the record stream

- toprettyprint

    Prettily prints records, one key to a line, great for making sense of very large records

- toptable

    Prints a multi-dimensional (pivot) table of values.  Very powerful.

# KEY SPECS

Many of the commands above take key arguments to specify or assign to a key in a
record. Almost all of the places where you can specify a key (which normally
means a first level key in the record), you can instead specify a key spec.

A key spec may be nested, and may index into arrays.  Use a `/` to nest into a
hash and a `#NUM` to index into an array (i.e. `#2`)

An example is in order, take a record like this:

    {"biz":["a","b","c"],"foo":{"bar 1":1},"zap":"blah1"}
    {"biz":["a","b","c"],"foo":{"bar 1":2},"zap":"blah2"}
    {"biz":["a","b","c"],"foo":{"bar 1":3},"zap":"blah3"}

In this case a key spec of `foo/bar 1` would have the values 1, 2, and 3
respectively.

Similarly, `biz/#0` would have the value of `a` for all 3 records

## Fuzzy matching

You can also prefix key specs with `@` to engage the fuzzy matching logic.
Matching is tried like this, in order, with the first key to match winning:

- 1. Exact match (eq)
- 2. Prefix match (m/^/)
- 3. Match anywehre in the key (m//)

Given the above example data and the fuzzy key spec `@b/#2`, the `b` portion
would expand to `biz` and `2` would be the index into the array, so all
records would have the value of `c`.

Simiarly, `@f/b` would have values 1, 2, and 3.

# WRITING YOUR OWN COMMANDS

The data stream format of the recs commands is JSON hashes separated by new
lines.  If you wish to write your own recs command in your own language, just
get a JSON parser and you should be good to go.  The recs commands use
[JSON::MaybeXS](https://metacpan.org/pod/JSON::MaybeXS).

If you name your command as `recs-mycommand` and put it somewhere in your
`PATH` environment variable, the `recs` command will dispatch to it when
called as `recs mycommand`.  It will also be included in `recs --list`
output.

If you want to write your new command in Perl, you can use the same Perl API
that the standard recs toolkit uses.  See the various
[App::RecordStream::Operation](https://metacpan.org/pod/App::RecordStream::Operation) subclasses.  Once your new operation class is
installed in perl's library paths, `recs` will find it automatically without
the need for any executable command shim.

# EXAMPLES

    # look in the custom access log for all accesses with greater than 5 seconds,
    # display in a table
    cat access.log \
      | recs fromre --fields ip,time '^(\d+).*TIME: (\d+)' \
      | recs grep '$r->{time} > 5' \
      | recs totable

# SEE ALSO

Each of the commands discussed have a `--help` mode available to print out
usage and examples for the particular command.  See that documentation for
detailed information on the operation of each of the commands.  Also see some
other man pages:

- Run `recs examples` or see [App::RecordStream::Manual::Examples](https://metacpan.org/pod/App::RecordStream::Manual::Examples) for a set of simple recs examples
- Run `recs story` or see [App::RecordStream::Manual::Story](https://metacpan.org/pod/App::RecordStream::Manual::Story) for a humorous introduction to RecordStream

# AUTHORS

Benjamin Bernard <perlhacker@benjaminbernard.com>

Keith Amling <keith.amling@gmail.com>

# COPYRIGHT AND LICENSE

Copyright 2007-2014 by Benjamin Bernard and Keith Amling.

This software is released under the MIT and Artistic 1.0 licenses.
