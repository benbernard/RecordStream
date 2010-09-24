use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'Recs::Operation::collate' ) };

my $stream = <<STREAM;
{"value":"10.0.0.101","element":"address", "foo": "bar"}
{"value":"10.0.1.101","element":"address", "foo": "bar3"}
{"value":"10.0.0.102","element":"address2", "foo": "bar3"}
{"value":"10.0.0.103","element":"address2", "foo": "bar"}
{"value":"10.0.1.103","element":"address2", "foo": "bar"}
STREAM

my $solution = <<SOLUTION;
{"count" : 5}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'collate',
   [qw(--a count)],
   $stream,
   $solution,
);

my $solution2 = <<SOLUTION;
{"count": 2, "element": "address"}
{"count": 3, "element": "address2"}
SOLUTION

Recs::Test::OperationHelper->do_match(
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

Recs::Test::OperationHelper->do_match(
   'collate',
   ['--key', 'element,foo', qw(--cube --perfect --a count)],
   $stream,
   $solution3,
);

