use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::frommultire' ) };

my $input;
my $output;

my $tester = App::RecordStream::Test::Tester->new('frommultire');

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
$tester->test_input(['--re', 'fname,lname=^Name: (.*) (.*)$'], $input, $output);

$input2 = <<INPUT;
Team: Recs
Location: 521 S Weller
Name: Keith Amling
Team: Futurama
Location: Omicron Persei 8
Name: Matt Groening
INPUT
$output = <<OUTPUT;
{"Team":"Recs","Location":"521 S Weller","Name":"Keith Amling"}
{"Team":"Futurama","Location":"Omicron Persei 8","Name":"Matt Groening"}
OUTPUT
$tester->test_input(['--re', '$1=(.*): (.*)'], $input2, $output);

$input2 = <<INPUT;
foo,bar=biz,zap ZOO
foo,bar=ready,run ZAP
INPUT
$output = <<OUTPUT;
{"foo":"biz","bar":"zap","0-2":"ZOO"}
{"foo":"ready","bar":"run","0-2":"ZAP"}
OUTPUT
$tester->test_input(['--re', '$1,$2=(.*),(.*)=(.*),(.*) ([A-Z]*)'], $input2, $output);

$output = <<OUTPUT;
{"team":"Recs","loc":"521 S Weller","fname":"Keith","lname":"Amling"}
{"team":"Recs","loc":"521 S Weller","fname":"Benjamin","lname":"Bernard"}
{"team":"Futurama","loc":"Omicron Persei 8","fname":"Matt","lname":"Groening"}
{"team":"Futurama","loc":"Omicron Persei 8","fname":"David","lname":"Cohen"}
OUTPUT
$tester->test_input(['--re', 'team=^Team: (.*)$', '--re', 'loc=^Location: (.*)$', '--post', 'fname,lname=^Name: (.*) (.*)$', '--clobber', '--keep-all'], $input, $output);

$output = <<OUTPUT;
{"team":"Recs","loc":"521 S Weller","fname":"Keith","lname":"Amling"}
{"team":"Recs","fname":"Benjamin","lname":"Bernard"}
{"team":"Futurama","loc":"Omicron Persei 8","fname":"Matt","lname":"Groening"}
{"team":"Futurama","fname":"David","lname":"Cohen"}
OUTPUT
$tester->test_input(['--re', 'team=^Team: (.*)$', '--re', 'loc=^Location: (.*)$', '--post', 'fname,lname=^Name: (.*) (.*)$', '--clobber', '--keep', 'team'], $input, $output);

$input = <<INPUT;
A:A1 A2
B:B1 B2 B3
INPUT
$output = <<OUTPUT;
{"a1":"A1","0-1":"A2","1-0":"B1","1-1":"B2","1-2":"B3"}
OUTPUT
$tester->test_input(['--re', 'a1=^A:([^ ]*) ([^ ]*)$', '--re', '^B:([^ ]*) ([^ ]*) ([^ ]*)$'], $input, $output);
