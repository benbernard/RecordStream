use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::grep' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'grep',
   [ '$r->{foo} > 2' ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'grep',
   [ '-v', '$r->{foo} > 2', ],
   $stream,
   $solution,
);
