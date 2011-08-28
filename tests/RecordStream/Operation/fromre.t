use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromre' ) };

my $input;
my $output;

my $tester = App::RecordStream::Test::Tester->new('fromre');

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
$tester->test_stdin(['-f', 'fname,lname', '^Name: (.*) (.*)$'], $input, $output);
$input = <<INPUT;
A:A1 A2 A3
INPUT
$output = <<OUTPUT;
{"a1":"A1","1":"A2","2":"A3"}
OUTPUT
$tester->test_stdin(['-f', 'a1', '^A:([^ ]*) ([^ ]*) ([^ ]*)$'], $input, $output);
$output = <<OUTPUT;
{"0":"A1","1":"A2","2":"A3"}
OUTPUT
$tester->test_stdin(['^A:([^ ]*) ([^ ]*) ([^ ]*)$'], $input, $output);
