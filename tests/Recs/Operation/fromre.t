use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::fromre' ) };

my $input;
my $output;

$input = <<INPUT;
Team: Recs
Location: 521 S Weller
Name: Keith Amling
Name: Benjamin Bernard
Team: Futurama
Location: Omicron Persei 8
Name: Matt Groening
Name: David Cohen
INPUT
$output = <<OUTPUT;
{"fname":"Keith","lname":"Amling"}
{"fname":"Benjamin","lname":"Bernard"}
{"fname":"Matt","lname":"Groening"}
{"fname":"David","lname":"Cohen"}
OUTPUT
test1(['-f', 'fname,lname', '^Name: (.*) (.*)$'], $input, $output);
$input = <<INPUT;
A:A1 A2 A3
INPUT
$output = <<OUTPUT;
{"a1":"A1","1":"A2","2":"A3"}
OUTPUT
test1(['-f', 'a1', '^A:([^ ]*) ([^ ]*) ([^ ]*)$'], $input, $output);
$output = <<OUTPUT;
{"0":"A1","1":"A2","2":"A3"}
OUTPUT
test1(['^A:([^ ]*) ([^ ]*) ([^ ]*)$'], $input, $output);

sub test1
{
   my ($args, $input, $output) = @_;

   open(STDIN, "-|", "echo", "-n", $input) || ok(0, "Cannot open echo?!");
   my $fromre = Recs::Operation::fromre->new($args);
   Recs::Test::OperationHelper->new("operation" => $fromre, "input" => undef, "output" => $output)->matches();
}
