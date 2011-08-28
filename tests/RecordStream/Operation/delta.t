use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::delta' ) };

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

App::RecordStream::Test::OperationHelper->do_match(
   'delta',
   [ '--key', 'foo' ],
   $stream,
   $solution,
);

# Test keyspec
App::RecordStream::Test::OperationHelper->do_match(
   'delta',
   [ '--key', '!fo!' ],
   $stream,
   $solution,
);
