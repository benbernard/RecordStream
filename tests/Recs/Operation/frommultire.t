use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::frommultire' ) };

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
test1(['--re', 'fname,lname=^Name: (.*) (.*)$'], $input, $output);
$output = <<OUTPUT;
{"team":"Recs","loc":"521 S Weller","fname":"Keith","lname":"Amling"}
{"team":"Recs","loc":"521 S Weller","fname":"Benjamin","lname":"Bernard"}
{"team":"Futurama","loc":"Omicron Persei 8","fname":"Matt","lname":"Groening"}
{"team":"Futurama","loc":"Omicron Persei 8","fname":"David","lname":"Cohen"}
OUTPUT
test1(['--re', 'team=^Team: (.*)$', '--re', 'loc=^Location: (.*)$', '--post', 'fname,lname=^Name: (.*) (.*)$', '--clobber', '--keep-all'], $input, $output);
$output = <<OUTPUT;
{"team":"Recs","loc":"521 S Weller","fname":"Keith","lname":"Amling"}
{"team":"Recs","fname":"Benjamin","lname":"Bernard"}
{"team":"Futurama","loc":"Omicron Persei 8","fname":"Matt","lname":"Groening"}
{"team":"Futurama","fname":"David","lname":"Cohen"}
OUTPUT
test1(['--re', 'team=^Team: (.*)$', '--re', 'loc=^Location: (.*)$', '--post', 'fname,lname=^Name: (.*) (.*)$', '--clobber', '--keep', 'team'], $input, $output);
$input = <<INPUT;
A:A1 A2
B:B1 B2 B3
INPUT
$output = <<OUTPUT;
{"a1":"A1","0-1":"A2","1-0":"B1","1-1":"B2","1-2":"B3"}
OUTPUT
test1(['--re', 'a1=^A:([^ ]*) ([^ ]*)$', '--re', '^B:([^ ]*) ([^ ]*) ([^ ]*)$'], $input, $output);

sub test1
{
   my ($args, $input, $output) = @_;

   open(STDIN, "-|", "echo", "-n", $input) || ok(0, "Cannot open echo?!");
   my $frommultire = Recs::Operation::frommultire->new($args);
   Recs::Test::OperationHelper->new("operation" => $frommultire, "input" => undef, "output" => $output)->matches();
}
