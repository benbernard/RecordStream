use Test::More qw(no_plan);
use App::RecordStream::Test::Tester;

BEGIN { use_ok( 'App::RecordStream::Operation::fromapache' ) };

my $tester = App::RecordStream::Test::Tester->new('fromapache');

my $input;
my $output;

# combined
$input = <<INPUT;
192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891 "-" "DoCoMo/2.0 P03B(c500;TB;W24H16)"
INPUT
$output = <<OUTPUT;
{"request":"GET /x/i.cgi/net/0000/ HTTP/1.1","bytes":"9891","proto":"HTTP/1.1","timezone":"+0900","status":"200","time":"10:59:59","date":"07/Feb/2011","rhost":"192.168.0.1","path":"/x/i.cgi/net/0000/","datetime":"07/Feb/2011:10:59:59 +0900","logname":"-","user":"-","agent":"DoCoMo/2.0 P03B(c500;TB;W24H16)","method":"GET","referer":"-"}
OUTPUT
$tester->test_input(['--fast'], $input, $output);

# common
$input = <<INPUT;
192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891
INPUT
$output = <<OUTPUT;
{"request":"GET /x/i.cgi/net/0000/ HTTP/1.1","bytes":"9891","proto":"HTTP/1.1","timezone":"+0900","status":"200","time":"10:59:59","date":"07/Feb/2011","rhost":"192.168.0.1","path":"/x/i.cgi/net/0000/","datetime":"07/Feb/2011:10:59:59 +0900","logname":"-","user":"-","method":"GET"}
OUTPUT
$tester->test_input(['--fast'], $input, $output);
