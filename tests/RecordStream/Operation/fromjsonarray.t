use Test::More qw(no_plan);

use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromjsonarray' ) };

my $tester = App::RecordStream::Test::Tester->new('fromjsonarray');

my $input;
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
OUTPUT
$tester->test_stdin(['--key', 'a'], $input1, $output);

$output = <<'OUTPUT';
{"a":1}
{"a":2,"b":2}
{}
{"b":4}
OUTPUT
$tester->test_stdin(['--key', 'a,b', '--preserve-empty'], $input1, $output);
