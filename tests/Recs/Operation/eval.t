use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'Recs::Operation::eval' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
1 biz1
2 biz2
3 biz3
4 biz4
5 biz5
SOLUTION

Recs::Test::OperationHelper->test_output(
   'eval',
   [ '$r->{foo} . " " . $r->{zoo}'],
   $stream,
   $solution,
);
