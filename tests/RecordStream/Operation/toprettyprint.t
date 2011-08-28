use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::toprettyprint' ) };

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

App::RecordStream::Test::OperationHelper->test_output(
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

App::RecordStream::Test::OperationHelper->test_output(
   'toprettyprint',
   [qw(--one)],
   $stream,
   $solution2,
);

$stream = <<NESTED;
{"foo":5,"zoo":"biz5","zap":{"bar":3}}
NESTED

my $solution4 = <<SOLUTION;
----------------------------------------------------------------------
foo = 5
zap = HASH:
   bar = 3
zoo = "biz5"
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'toprettyprint',
   ['--one'],
   $stream,
   $solution4,
);

my $solution5 = <<SOLUTION;
----------------------------------------------------------------------
foo = 5
zap = {"bar":3}
zoo = "biz5"
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'toprettyprint',
   ['--one', '--nonested'],
   $stream,
   $solution5,
);

$stream = <<NESTED;
{"foo":{},"zoo":"biz5","zap":["bar",{"one":1}]}
NESTED

my $solution6 = <<SOLUTION;
----------------------------------------------------------------------
foo = EMPTY HASH
zap = ARRAY:
   0 = HASH:
      one = 1
   1 = "bar"
zoo = "biz5"
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'toprettyprint',
   ['--one'],
   $stream,
   $solution6,
);
