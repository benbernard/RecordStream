use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromsplit' ) };

my $input;
my $output;

my $tester = App::RecordStream::Test::Tester->new('fromsplit');

$output = <<OUTPUT;
{"f1":"A1","1":"A2,2","2":"A3"}
{"f1":"B1","1":"B2","2":"B3,B4","3":"B5"}
OUTPUT

$tester->no_input_test(['-f', 'f1', '-d', ' ', 'tests/files/splitfile'], $output);

$output = <<OUTPUT;
{"0":"A1 A2","1":"2 A3"}
{"0":"B1 B2 B3","1":"B4 B5"}
OUTPUT

$tester->no_input_test([qw(tests/files/splitfile)], $output);

$output = <<OUTPUT;
{"A1 A2":"B1 B2 B3","2 A3":"B4 B5"}
OUTPUT

$tester->no_input_test(['--header', qw(tests/files/splitfile)], $output);

$input = <<INPUT;
foo bar  baz
foo bar biz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"","3":"baz"}
{"1":"bar","0":"foo","2":"biz"}
OUTPUT
$tester->test_input(['--strict', '--delim', ' '], $input, $output);

$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar","0":"foo","2":"biz"}
OUTPUT
$tester->test_input(['--delim', '\s+'], $input, $output);
