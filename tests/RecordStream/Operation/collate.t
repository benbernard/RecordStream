use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::collate' ) };

my $stream = <<STREAM;
{"value":"10.0.0.101","element":"address", "foo": "bar", "bar": "baz"}
{"value":"10.0.1.101","element":"address", "foo": "bar3", "bar": "baz2"}
{"value":"10.0.0.102","element":"address2", "foo": "bar3", "bar": "baz2"}
{"value":"10.0.0.103","element":"address2", "foo": "bar", "bar": "baz3"}
{"value":"10.0.1.103","element":"address2", "foo": "bar", "bar": "baz"}
STREAM

my $solution = <<SOLUTION;
{"count" : 5}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'collate',
   [qw(--a count)],
   $stream,
   $solution,
);

my $solution2 = <<SOLUTION;
{"count": 2, "element": "address"}
{"count": 3, "element": "address2"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'collate',
   [qw(--key element --a count)],
   $stream,
   $solution2,
);

my $solution3 = <<SOLUTION;
{"count":1,"foo":"bar","element":"address"}
{"count":2,"foo":"ALL","element":"address"}
{"count":1,"foo":"bar3","element":"address"}
{"count":2,"foo":"bar3","element":"ALL"}
{"count":1,"foo":"bar3","element":"address2"}
{"count":5,"foo":"ALL","element":"ALL"}
{"count":3,"foo":"bar","element":"ALL"}
{"count":3,"foo":"ALL","element":"address2"}
{"count":2,"foo":"bar","element":"address2"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'collate',
   ['--key', 'element,foo', qw(--cube --a count)],
   $stream,
   $solution3,
);

# Test KeySpecs
App::RecordStream::Test::OperationHelper->do_match(
   'collate',
   ['--key', '!element|foo!s', qw(--cube --a count)],
   $stream,
   $solution3,
);

my $solution4 = <<SOLUTION;
{"sweet":"barbaz","foo":"bar","element":"address"}
{"sweet":"bar3baz2","foo":"bar3","element":"address"}
{"sweet":"bar3baz2","foo":"bar3","element":"address2"}
{"sweet":"barbaz,barbaz3","foo":"bar","element":"address2"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'collate',
   ['--key', 'element', '--dlkey', 'foo=sub{shift->{foo}}', '--dlaggregator', 'sweet=uconcat(",", val(sub{$_[0]->{foo}.$_[0]->{bar};}))'],
   $stream,
   $solution4,
);
