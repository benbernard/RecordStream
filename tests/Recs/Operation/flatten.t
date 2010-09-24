use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::flatten' ) };

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

Recs::Test::OperationHelper->do_match(
   'flatten',
   [ qw(--deep foo) ],
   $stream,
   $solution,
);

Recs::Test::OperationHelper->do_match(
   'flatten',
   [ qw(--field foo) ],
   $stream,
   $solution2,
);

Recs::Test::OperationHelper->do_match(
   'flatten',
   [ qw(--depth 2 --field foo) ],
   $stream,
   $solution3,
);
