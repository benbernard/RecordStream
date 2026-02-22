use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::substream' ) };

my $stream = <<STREAM;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
STREAM

App::RecordStream::Test::OperationHelper->do_match(
  'substream',
  [],
  $stream,
  $stream,
);

my $solution = <<SOLUTION;
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'substream',
  ['-b', '$r->{foo} > 1'],
  $stream,
  $solution,
);

$solution = <<SOLUTION;
{"foo":1,"zoo":"biz1"}
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'substream',
  ['-e', '$r->{foo} > 4'],
  $stream,
  $solution,
);

$solution = <<SOLUTION;
{"foo":2,"zoo":"biz2"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'substream',
  ['-b', '$r->{foo} == 2', '-e', '$r->{foo} == 2'],
  $stream,
  $solution,
);

$solution = <<SOLUTION;
{"foo":2,"zoo":"biz2"}
{"foo":3,"zoo":"biz3"}
{"foo":4,"zoo":"biz4"}
{"foo":5,"zoo":"biz5"}
{"foo":1,"zoo":"biz1"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'substream',
  ['-b', '$r->{foo} == 2', '-e', '$r->{zoo} eq "biz1"'],
  $stream,
  $solution,
);
