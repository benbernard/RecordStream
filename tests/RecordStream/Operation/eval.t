use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::eval' ) };

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

App::RecordStream::Test::OperationHelper->test_output(
   'eval',
   [ '$r->{foo} . " " . $r->{zoo}'],
   $stream,
   $solution,
);

$solution = '1 biz12 biz23 biz34 biz45 biz5';

App::RecordStream::Test::OperationHelper->test_output(
   'eval',
   [ '--no-newline', '$r->{foo} . " " . $r->{zoo}'],
   $stream,
   $solution,
);
