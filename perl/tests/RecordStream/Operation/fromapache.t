use strict;
use warnings;
use Test::More;
use App::RecordStream::Test::OperationHelper 'fromapache';
use App::RecordStream::Test::Tester;

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

# combined with woothee
SKIP: {
    skip "Missing Woothee Modules!" unless eval { require Woothee };

    $output = <<OUTPUT;
{"request":"GET /x/i.cgi/net/0000/ HTTP/1.1","bytes":"9891","proto":"HTTP/1.1","timezone":"+0900","status":"200","time":"10:59:59","date":"07/Feb/2011","rhost":"192.168.0.1","path":"/x/i.cgi/net/0000/","datetime":"07/Feb/2011:10:59:59 +0900","logname":"-","user":"-","agent":"DoCoMo/2.0 P03B(c500;TB;W24H16)","method":"GET","referer":"-","woothee":{"version":"P03B","name":"docomo","category":"mobilephone","vendor":"docomo","os":"docomo","os_version":"UNKNOWN"}}
OUTPUT
    # Woothee 1.0.0 added the os_version field; remove it for previous versions
    $output =~ s/,"os_version":"UNKNOWN"// if $Woothee::VERSION =~ /^0[.]/;
    $tester->test_input(['--fast', '--woothee'], $input, $output);
}

# common
$input = <<'INPUT';
123.160.48.6 - - [22/Mar/2014:03:12:29 +0900] "GET /?a=\"b\" HTTP/1.1" 200 739 "-" "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; .NET CLR 1.1.4322; .NET CLR 2.0.50727; .NET CLR 3.0.04506.648; .NET CLR 3.5.21022; InfoPath.1; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729; .NET4.0C; .NET4.0E; OfficeLiveConnector.1.5; OfficeLivePatch.1.3)"
INPUT
$output = <<'OUTPUT';
{"request":"GET /?a=\\\"b\\\" HTTP/1.1","proto":"HTTP/1.1","bytes":"739","timezone":"+0900","date":"22/Mar/2014","time":"03:12:29","status":"200","rhost":"123.160.48.6","path":"/?a=\\\"b\\\"","datetime":"22/Mar/2014:03:12:29 +0900","logname":"-","agent":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; .NET CLR 1.1.4322; .NET CLR 2.0.50727; .NET CLR 3.0.04506.648; .NET CLR 3.5.21022; InfoPath.1; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729; .NET4.0C; .NET4.0E; OfficeLiveConnector.1.5; OfficeLivePatch.1.3)","user":"-","method":"GET","referer":"-"}
OUTPUT

# options spec
$tester->test_input([], $input, $output);
$tester->test_input(['--fast'], $input, $output);
$tester->test_input(['--fast=1'], $input, $output);
$tester->test_input(['--fast', '1'], $input, $output);
$tester->test_input(['--fast', '--verbose'], $input, $output);
$tester->test_input(['--fast', '--strict=0'], $input, $output);

$output = <<'OUTPUT';
{"request":"GET /?a=\"b\" HTTP/1.1","proto":"HTTP/1.1","bytes":"739","timezone":"+0900","time":"03:12:29","date":"22/Mar/2014","status":"200","rhost":"123.160.48.6","path":"/?a=\"b\"","datetime":"22/Mar/2014:03:12:29 +0900","logname":"-","agent":"Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; .NET CLR 1.1.4322; .NET CLR 2.0.50727; .NET CLR 3.0.04506.648; .NET CLR 3.5.21022; InfoPath.1; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729; .NET4.0C; .NET4.0E; OfficeLiveConnector.1.5; OfficeLivePatch.1.3)","user":"-","method":"GET","referer":"-"}
OUTPUT

$tester->test_input(['--strict'], $input, $output);
$tester->test_input(['--strict=1'], $input, $output);
$tester->test_input(['--strict', '1'], $input, $output);
$tester->test_input(['--fast=0', '--strict'], $input, $output);

eval {
  $tester->test_input(['--fast', '--strict'], $input, $output);
};
like $@, qr/^only one option from 'strict' or 'fast' required/;

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

done_testing;
