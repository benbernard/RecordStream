use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::stream2table' ) };

my $stream = <<STREAM;
{ "column": "foo", "data": "foo1" }
{ "column": "foo", "data": "foo2" }
{ "column": "boo", "data": "boo1" }
{ "column": "boo", "data": "boo2" }
STREAM

my $solution = <<SOLUTION;
{"boo":{"data":"boo1"},"foo":{"data":"foo1"}}
{"boo":{"data":"boo2"},"foo":{"data":"foo2"}}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'stream2table',
   ['--field', 'column'],
   $stream,
   $solution,
);
