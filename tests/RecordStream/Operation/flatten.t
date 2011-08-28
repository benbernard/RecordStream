use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::flatten' ) };

my $stream = <<STREAM;
{"foo": {"zoo":"biz3"}}
{"foo": {"zoo": { "bar" : {"zip": 1} }}}
{"foo": [ "a", "b" ] }
STREAM

my $solution = <<SOLUTION;
{"foo-zoo": "biz3"}
{"foo-zoo-bar-zip" : 1 }
{"foo-0":  "a", "foo-1": "b"}
SOLUTION

my $solution2 = <<SOLUTION2;
{"foo-zoo": "biz3"}
{"foo-zoo" : { "bar": {"zip": 1 }}}
{"foo-0":  "a", "foo-1": "b"}
SOLUTION2

my $solution3 = <<SOLUTION3;
{"foo-zoo": "biz3"}
{"foo-zoo-bar" :  {"zip": 1 }}
{"foo-0":  "a", "foo-1": "b"}
SOLUTION3

App::RecordStream::Test::OperationHelper->do_match(
   'flatten',
   [ qw(--deep foo) ],
   $stream,
   $solution,
);

App::RecordStream::Test::OperationHelper->do_match(
   'flatten',
   [ qw(--field foo) ],
   $stream,
   $solution2,
);

App::RecordStream::Test::OperationHelper->do_match(
   'flatten',
   [ qw(--depth 2 --field foo) ],
   $stream,
   $solution3,
);
