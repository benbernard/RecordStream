use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::fromkv' ) };

my $input;
my $output;

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

test1(['--kv-delim', '=', '--record-delim', "%\n"], $input, $output);

$input = <<INPUT;
a=1|b=2|c=3%
d=4|e=5|f=6%
INPUT

$output = <<OUTPUT;
{"c":"3","a":"1","b":"2"}
{"d":"4","e":"5","f":"6"}
OUTPUT

test1(['--kv-delim', '=', '--entry-delim', '|', '--record-delim', "%\n"], $input, $output);

$input = <<INPUT;
a=1|b=2|c=3\%d=4|e=5|f=6
INPUT

$output = <<OUTPUT;
{"c":"3","a":"1","b":"2"}
{"d":"4","e":"5","f":"6"}
OUTPUT

test1(['--kv-delim', '=', '--entry-delim', '|', '--record-delim', "%"], $input, $output);

sub test1
{
   my ($args, $input, $output) = @_;

   open(STDIN, "-|", "echo", "-n", $input) || ok(0, "Cannot open echo?!");
   my $fromre = Recs::Operation::fromkv->new($args);
   Recs::Test::OperationHelper->new("operation" => $fromre, "input" => undef, "output" => $output)->matches();
}
