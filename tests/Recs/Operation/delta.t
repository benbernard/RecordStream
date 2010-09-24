use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::delta' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":1,"zoo":"biz2"}
{"foo":2,"zoo":"biz3"}
{"foo":2,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
{"foo":0,"zoo":"biz1"}
{"foo":1,"zoo":"biz2"}
{"foo":0,"zoo":"biz3"}
{"foo":3,"zoo":"biz4"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'delta',
   [ '--key', 'foo' ],
   $stream,
   $solution,
);
