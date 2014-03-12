use Test::More qw(no_plan);

use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromjsonarray' ) };

my $tester = App::RecordStream::Test::Tester->new('fromjsonarray');

my ($input1, $input2);
my $output;

$input1 = <<'INPUT';
[{"a": 1, "foo": "bar"},{"b": 2, "a": 2},{"c": 3},{"b": 4}]
INPUT

$input2 = <<'INPUT';
[
  {
    "a": 1,
    "foo": "bar"
  },
  {"b": 2, "a": 2},
  {"c": 3},
  {"b": 4}
]
INPUT

$output = <<'OUTPUT';
{"a":1,"foo":"bar"}
{"a":2,"b":2}
{"c":3}
{"b":4}
OUTPUT
$tester->test_stdin([], $input1, $output);
$tester->test_stdin([], $input2, $output);

$output = <<'OUTPUT';
{"a":1}
{"a":2}
{"a":null}
{"a":null}
OUTPUT
$tester->test_stdin(['--key', 'a'], $input1, $output);

$output = <<'OUTPUT';
{"a":1,"b":null}
{"a":2,"b":2}
{"a":null,"b":null}
{"a":null,"b":4}
OUTPUT
$tester->test_stdin(['--key', 'a,b'], $input1, $output);

$input1 = <<'INPUT';
[{"a": [1, 2], "b": {"foo": "bar1", "baz": "biz1"}, "c": 0},
{"a": [3, 4], "b": {"foo": "bar2", "baz": "biz2"}, "c": 2},
{"c": 4, "a": ["foo", "baz"]},
{"d": 4}]
INPUT

$output = <<'OUTPUT';
{"a/#1":2,"b/foo":"bar1"}
{"a/#1":4,"b/foo":"bar2"}
{"a/#1":"baz","b/foo":null}
{"a/#1":null,"b/foo":null}
OUTPUT
$tester->test_stdin(['--key', 'a/#1', '--key', 'b/foo'], $input1, $output);
