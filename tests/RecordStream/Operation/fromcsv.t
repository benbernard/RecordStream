use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromcsv' ) };

my $tester = App::RecordStream::Test::Tester->new('fromcsv');

my $input;
my $output;

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar loo","0":"foo loo","2":"baz"}
OUTPUT
$tester->test_stdin([], $input, $output);

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar loo","0":"foo loo","2":" baz"}
OUTPUT
$tester->test_stdin(['--strict'], $input, $output);

$input = <<INPUT;
one,two,three
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"two":"bar","one":"foo","three":"baz"}
{"two":"bar loo","one":"foo loo","three":"baz"}
OUTPUT
$tester->test_stdin(['--header'], $input, $output);

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"zip":["foo", "bar", "baz"]}
{"zip":["foo loo","bar loo","baz"]}
OUTPUT
$tester->test_stdin(['--key', 'zip/#0,zip/#1,zip/#2'], $input, $output);

$input = <<INPUT;
foo,bar,baz
"foo
loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"zip":["foo", "bar", "baz"]}
{"zip":["foo\\nloo","bar loo","baz"]}
OUTPUT
$tester->test_stdin(['--key', 'zip/#0,zip/#1,zip/#2'], $input, $output);
