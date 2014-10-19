use Test::More;
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::tocsv' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

my $solution = <<SOLUTION;
foo,zoo
1,biz1
2,biz2
3,biz3
4,biz4
5,biz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
  'tocsv',
  [],
  $stream,
  $solution,
);

App::RecordStream::Test::OperationHelper->test_output(
  'tocsv',
  ['--key', '!oo!sort'],
  $stream,
  $solution,
);

$solution = <<SOLUTION;
1,biz1
2,biz2
3,biz3
4,biz4
5,biz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
  'tocsv',
  ['--noheader'],
  $stream,
  $solution,
);

$solution = <<SOLUTION;
foo
1
2
3
4
5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
  'tocsv',
  ['--key', 'foo'],
  $stream,
  $solution,
);

$solution = <<SOLUTION;
foo\tzoo
1\tbiz1
2\tbiz2
3\tbiz3
4\tbiz4
5\tbiz5
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
  'tocsv',
  ['--key', 'foo,zoo', '--delim', "\t"],
  $stream,
  $solution,
);

done_testing;
