use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::topn' ) };

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

App::RecordStream::Test::OperationHelper->do_match(
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

App::RecordStream::Test::OperationHelper->do_match(
   'topn',
   [ '--key', 'foo', '-n', 2 ],
   $stream,
   $solution,
);

App::RecordStream::Test::OperationHelper->do_match(
   'topn',
   [ '--key', '!fo!', '-n', 2 ],
   $stream,
   $solution,
);
