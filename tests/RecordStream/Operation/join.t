use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::join' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
{"bar":"join_a","foo":3,"zoo":"biz3"}
{"bar":"join_b","foo":4,"zoo":"biz4"}
{"bar":"join_c","foo":5,"zoo":"biz5"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'join',
   [ qw(foo foo tests/files/join1) ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"bar":"join_a","foo":3,"zoo":"biz3"}
{"bar":"join_b","foo":4,"zoo":"biz4"}
{"bar":"join_c","foo":5,"zoo":"biz5"}
{"bar":"join_d","foo":6}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'join',
   [ qw(foo foo tests/files/join1 --left) ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"bar":"join_a","foo":3,"zoo":"biz3"}
{"bar":"join_b","foo":4,"zoo":"biz4"}
{"bar":"join_c","foo":5,"zoo":"biz5"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'join',
   [ qw(foo foo tests/files/join1 --right) ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"bar":"join_a","zipper":1,"foo":3}
{"bar":"join_b","zipper":1,"foo":4}
{"bar":"join_c","zipper":1,"foo":5}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'join',
   [ qw(foo foo tests/files/join1 --operation), '$d->{zipper} = 1' ],
   $stream,
   $solution,
);

