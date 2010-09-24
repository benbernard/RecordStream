use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::toprettyprint' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
----------------------------------------------------------------------
foo = 1
zoo = "biz1"
----------------------------------------------------------------------
foo = 2
zoo = "biz2"
----------------------------------------------------------------------
foo = 3
zoo = "biz3"
----------------------------------------------------------------------
foo = 4
zoo = "biz4"
----------------------------------------------------------------------
foo = 5
zoo = "biz5"
SOLUTION

Recs::Test::OperationHelper->test_output(
   'toprettyprint',
   [],
   $stream,
   $solution,
);

my $solution2 = <<SOLUTION;
----------------------------------------------------------------------
foo = 1
zoo = "biz1"
SOLUTION

Recs::Test::OperationHelper->test_output(
   'toprettyprint',
   [qw(--one)],
   $stream,
   $solution2,
);
