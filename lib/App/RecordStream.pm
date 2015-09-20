use strict;
use warnings;

package App::RecordStream;

our $VERSION = "4.0.16";

=encoding utf-8

=for markdown
[![CPAN version](https://badge.fury.io/pl/App-RecordStream.png)](https://metacpan.org/release/App-RecordStream)
[![Build Status](https://travis-ci.org/benbernard/RecordStream.svg?branch=master)](https://travis-ci.org/benbernard/RecordStream)

=head1 NAME

App::RecordStream - recs - A system for command-line analysis of data

=head1 SYNOPSIS

A set of programs for creating, manipulating, and outputting a stream of
Records, or JSON hashes.  Inspired by Monad.

=head1 INSTALLATION

=head2 Quick, standalone bundle

The quickest way to start using recs is via the minimal, standalone bundle:

  curl -fsSL https://recs.pl > recs
  chmod +x recs
  ./recs --help

This is also known as the "fatpacked" recs.

=head2 From CPAN

You can also install recs from L<CPAN|http://cpan.org> as App::RecordStream:

  cpanm --interactive App::RecordStream

Using L<cpanm> in interactive mode will prompt you for optional feature
support.  Other CPAN clients such as L<cpan> and L<cpanp> also work fine, but
you can't opt to use any optional features (just like cpanm in non-interactive
mode).  A kitchen-sink install of App::RecordStream looks like:

  cpanm --with-recommends --with-all-features App::RecordStream

If you don't have L<cpanm> itself, you can install it easily with:

  curl -fsSL https://cpanmin.us | perl - App::cpanminus

=head1 DESCRIPTION

The recs system consists of three basic sets of commands:

=over 4

=item * I<Input> commands responsible for generating streams of record objects

=item * I<Manipulation> commands responsible for analyzing, selecting, and manipulating records

=item * I<Output> commands responsible for taking record streams and producing output for humans or other programs

=back

These commands can interface with other systems to retrieve data, parse existing
files, or just regex out some values from a text stream.

Commands are run using C<recs command [options and arguments]>.  If you're using
a CPAN-based install, you may also run commands directly as C<recs-command>,
though this is no longer recommended for forwards compatibility.  Both
L<installation methods|/INSTALLATION> provide a top-level C<recs> executable
which dispatches to commands, so this is the preferred invocation style.

The core recs commands are briefly summarized below, and you can list all
available commands by running C<recs --list>.

To read more about each command, run C<recs command --help>.  Longer
documentation is available as C<recs command --help-all> or C<perldoc recs-command>.
For example, to read more about L</fromcsv>, you might run any of the
following:

  recs fromcsv --help
  recs fromcsv --help-all
  perldoc recs-fromcsv

=head1 COMMANDS

=head2 Input Generation

=over 4

=item fromcsv

Produces records from a csv file/stream

=item fromdb

Produces records for a db table, or from a SELECT statement into a db.

=item fromre

Matches input streams against a regex, puts capture groups into hashes

=item frommongo

Generate a record stream from a MongoDB query.

=item frommultire

Matches input streams against several regexes, puts capture groups into the record

=item fromsplit

Splits input stream on a delimiter

=item fromps

Generate records from the process tree

=item fromatomfeed

Produces records for an optionally paginated atom feed.

=item fromxml

Produces records for an XML document.

=item fromkv

Produces records from input streams containing loosely formed key/value pairs

=item fromtcpdump

Produces records from packet capture files (.pcap) as made by tcpdump

=back

=head2 Stream Manipulation

=over 4

=item annotate

Annotate records with common fields, will memoize additions to speed up common
annotations

=item collate

Perforce aggregation operations on records.  Group by a field, get an average,
sum, correlation, etc.  Very powerful

=item delta

Transform values into deltas between adjacent records

=item eval

Eval a string of Perl against each record

=item flatten

Flatten records of input to one level

=item grep

Select records for which a string of Perl evaluates to true.

=item multiplex

Take records, grouped by keys, and run a separate recs command for each group.

=item normalizetime

Based on a time field, tag records with a normalized time, i.e. every 5 minute buckets

=item join

Perform an inner join of two record streams.  Associate records in one stream
with another stream.

=item substream

Filter to a range of matching records with paired Perl snippets C<--start> and C<--end>.

=item sort

Sort records based on keys, may specify multiple levels of sorting, as well as
numerical or lexical sort ordering

=item topn

Outputs the top I<n> records. You may segment the input based on a list of keys
such that unique values of keys are treated as distinct input streams. This
enables top I<n> listings per value groupings.

=item xform

Perform a block of Perl on each record, which may modify the record, Record is
then output

=item generate

Perform a block of Perl on each record to generate a record stream, which is
then output with a chain link back to the original record.

=back

=head2 Output Generation

=over 4

=item todb

Inserts records into a DBI supported SQL database.  Will create a local SQLite
database by default

=item tocsv

Generates correctly quoted CSV files from record streams.

=item tognuplot

Create a graph of field values in a record using GNU Plot.

=item totable

Pretty prints a table of results.

=item tohtml

Prints out an HTML table of the record stream

=item toprettyprint

Prettily prints records, one key to a line, great for making sense of very large records

=item toptable

Prints a multi-dimensional (pivot) table of values.  Very powerful.

=back

=head1 KEY SPECS

Many of the commands above take key arguments to specify or assign to a key in a
record. Almost all of the places where you can specify a key (which normally
means a first level key in the record), you can instead specify a key spec.

A key spec may be nested, and may index into arrays.  Use a C</> to nest into a
hash and a C<#NUM> to index into an array (i.e. C<#2>)

An example is in order, take a record like this:

  {"biz":["a","b","c"],"foo":{"bar 1":1},"zap":"blah1"}
  {"biz":["a","b","c"],"foo":{"bar 1":2},"zap":"blah2"}
  {"biz":["a","b","c"],"foo":{"bar 1":3},"zap":"blah3"}

In this case a key spec of C<foo/bar 1> would have the values 1, 2, and 3
respectively.

Similarly, C<biz/#0> would have the value of C<a> for all 3 records

=head2 Fuzzy matching

You can also prefix key specs with C<@> to engage the fuzzy matching logic.
Matching is tried like this, in order, with the first key to match winning:

=over 4

=item 1. Exact match (C<eq>)

=item 2. Prefix match (C<m/^/>)

=item 3. Match anywhere in the key (C<m//>)

=back

Given the above example data and the fuzzy key spec C<@b/#2>, the C<b> portion
would expand to C<biz> and C<2> would be the index into the array, so all
records would have the value of C<c>.

Simiarly, C<@f/b> would have values 1, 2, and 3.

=head1 WRITING YOUR OWN COMMANDS

The data stream format of the recs commands is JSON hashes separated by new
lines.  If you wish to write your own recs command in your own language, just
get a JSON parser and you should be good to go.  The recs commands use
L<JSON::MaybeXS>.

If you name your command as C<recs-mycommand> and put it somewhere in your
C<PATH> environment variable, the C<recs> command will dispatch to it when
called as C<recs mycommand>.  It will also be included in C<recs --list>
output.

If you want to write your new command in Perl, you can use the same Perl API
that the standard recs toolkit uses.  See the various
L<App::RecordStream::Operation> subclasses.  Once your new operation class is
installed in perl's library paths, C<recs> will find it automatically without
the need for any executable command shim.

=head1 EXAMPLES

  # look in the custom access log for all accesses with greater than 5 seconds,
  # display in a table
  cat access.log \
    | recs fromre --fields ip,time '^(\d+).*TIME: (\d+)' \
    | recs grep '$r->{time} > 5' \
    | recs totable

=head1 SEE ALSO

Each of the commands discussed have a C<--help> mode available to print out
usage and examples for the particular command.  See that documentation for
detailed information on the operation of each of the commands.  Also see some
other man pages:

=over

=item * Run C<recs examples> or see L<App::RecordStream::Manual::Examples> for a set of simple recs examples

=item * Run C<recs story> or see L<App::RecordStream::Manual::Story> for a humorous introduction to RecordStream

=back

=head1 AUTHORS

Benjamin Bernard <perlhacker@benjaminbernard.com>

Keith Amling <keith.amling@gmail.com>
 
=head1 COPYRIGHT AND LICENSE

Copyright 2007–2015 by Benjamin Bernard and Keith Amling.

This software is released under the MIT and Artistic 1.0 licenses.

=cut

1;
