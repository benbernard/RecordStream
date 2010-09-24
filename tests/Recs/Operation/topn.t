use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::topn' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":1,"zoo":"biz2"}
{"foo":2,"zoo":"biz3"}
{"foo":2,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz3"}
{"foo":5,"zoo":"biz5"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'topn',
   [ '--key', 'foo', '-n', 1 ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"foo":1,"zoo":"biz1"}
{"foo":1,"zoo":"biz2"}
{"foo":2,"zoo":"biz3"}
{"foo":2,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'topn',
   [ '--key', 'foo', '-n', 2 ],
   $stream,
   $solution,
);
