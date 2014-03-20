use strict;
use warnings;
use App::RecordStream::Test::Tester;

BEGIN {
  eval {
    require Apache::Log::Parser;
  };

  if ( $@ ) {
    require Test::More;
    import Test::More skip_all => 'Missing Apache::Log::Parser Modules!';
  }
  else {
    require Test::More;
    import Test::More qw(no_plan);
    use_ok( 'App::RecordStream::Operation::fromapache' );
  }
};

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

# options spec
$tester->test_input(['--fast'], $input, $output);
$tester->test_input(['--fast=1'], $input, $output);
$tester->test_input(['--fast', '1'], $input, $output);
$tester->test_input(['--strict'], $input, $output);
$tester->test_input(['--strict=1'], $input, $output);
$tester->test_input(['--strict', '1'], $input, $output);
$tester->test_input(['--fast', '--verbose'], $input, $output);

eval {
  $tester->test_input(['--fast', '--strict'], $input, $output);
};
like $@, qr/^only one option from 'strict' or 'fast' required/;

$tester->test_input(['--fast', '--strict=0'], $input, $output);
$tester->test_input(['--fast=0', '--strict'], $input, $output);

# input is vhost. parser mode is vhost. output is vhost.
$input = <<INPUT;
example.com 192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891
INPUT
$output = <<OUTPUT;
{"request":"GET /x/i.cgi/net/0000/ HTTP/1.1","bytes":"9891","proto":"HTTP/1.1","timezone":"+0900","status":"200","date":"07/Feb/2011","time":"10:59:59","rhost":"192.168.0.1","path":"/x/i.cgi/net/0000/","datetime":"07/Feb/2011:10:59:59 +0900","logname":"-","vhost":"example.com","user":"-","method":"GET"}
OUTPUT
$tester->test_input(['--strict', '["vhost_common"]'], $input, $output);

# input is vhost. parser mode is not vhost. output is nothing.
$input = <<INPUT;
example.com 192.168.0.1 - - [07/Feb/2011:10:59:59 +0900] "GET /x/i.cgi/net/0000/ HTTP/1.1" 200 9891
INPUT
$output = <<OUTPUT;
OUTPUT
$tester->test_input(['--strict', '["common"]'], $input, $output);

eval {
  $tester->test_input(['--strict', '["common"'], $input, $output);
};
like $@, qr/^eval of option strict failed\. syntax error at/;

eval {
  $tester->test_input(['--fast', '["common"'], $input, $output);
};
like $@, qr/^eval of option fast failed\. syntax error at/;
