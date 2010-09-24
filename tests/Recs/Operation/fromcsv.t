use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::fromcsv' ) };

my $input;
my $output;

$input = <<INPUT;
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"1":"bar","0":"foo","2":"baz"}
{"1":"bar loo","0":"foo loo","2":" baz"}
OUTPUT
test1([], $input, $output);

$input = <<INPUT;
one,two,three
foo,bar,baz
"foo loo","bar loo", baz
INPUT
$output = <<OUTPUT;
{"two":"bar","one":"foo","three":"baz"}
{"two":"bar loo","one":"foo loo","three":" baz"}
OUTPUT
test1(['--header'], $input, $output);

sub test1
{
   my ($args, $input, $output) = @_;

   open(STDIN, "-|", "echo", "-n", $input) || ok(0, "Cannot open echo?!");
   my $fromre = Recs::Operation::fromcsv->new($args);
   Recs::Test::OperationHelper->new("operation" => $fromre, "input" => undef, "output" => $output)->matches();
}
