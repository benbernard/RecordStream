use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromkv' ) };

my $input;
my $output;

my $tester = App::RecordStream::Test::Tester->new('fromkv');

$input = <<INPUT;

a=1
b=2
c=3
%
d=4
e=5
f=6
%
INPUT

$output = <<OUTPUT;
{"c":"3","a":"1","b":"2"}
{"d":"4","e":"5","f":"6"}
OUTPUT

$tester->test_stdin(['--kv-delim', '=', '--record-delim', "%\n"], $input, $output);

$input = <<INPUT;
a=1|b=2|c=3%
d=4|e=5|f=6%
INPUT

$output = <<OUTPUT;
{"c":"3","a":"1","b":"2"}
{"d":"4","e":"5","f":"6"}
OUTPUT

$tester->test_stdin(['--kv-delim', '=', '--entry-delim', '|', '--record-delim', "%\n"], $input, $output);

$input = <<INPUT;
a=1|b=2|c=3\%d=4|e=5|f=6
INPUT

$output = <<OUTPUT;
{"c":"3","a":"1","b":"2"}
{"d":"4","e":"5","f":"6"}
OUTPUT

$tester->test_stdin(['--kv-delim', '=', '--entry-delim', '|', '--record-delim', "%"], $input, $output);
