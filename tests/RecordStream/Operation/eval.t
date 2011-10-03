use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::eval' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1","boo":"boo1"}
{"foo":2,"zoo":"biz2","boo":"boo2\\n"}
{"foo":3,"zoo":"biz3","boo":"boo3"}
{"foo":4,"zoo":"biz4","boo":"boo4\\n"}
{"foo":5,"zoo":"biz5","boo":"boo5"}
STREAM

my $solution = <<SOLUTION;
1 biz1
2 biz2
3 biz3
4 biz4
5 biz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'eval',
   ['$r->{foo} . " " . $r->{zoo}'],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
boo1
boo2

boo3
boo4

boo5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'eval',
   ['$r->{boo}'],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
boo1
boo2
boo3
boo4
boo5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'eval',
   ['--chomp', '$r->{boo}'],
   $stream,
   $solution,
);
