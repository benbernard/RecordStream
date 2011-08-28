use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::tognuplot' ) };

my $stream = <<STREAM;
{"uid":"syslog","ct":1}
{"uid":"messagebus","ct":1}
{"uid":"avahi","ct":2}
{"uid":"daemon","ct":1}
{"uid":"gdm","ct":1}
{"uid":"rtkit","ct":1}
{"uid":"haldaemon","ct":2}
{"uid":"root","ct":75}
{"uid":"bernard","ct":58}
STREAM

my $solution = <<SOLUTION;
1
1
2
1
1
1
2
75
58
set terminal png
set output 'TEMP_TEST_OUTPUT.png'
set title 'ct'
set style data linespoints
plot 'screen' using 1 title "ct" 
Wrote graph file: TEMP_TEST_OUTPUT.png
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
   'tognuplot',
   ['--dump-to-screen', '--key', 'ct', '--lines', '--file', 'TEMP_TEST_OUTPUT.png'],
   $stream,
   $solution,
);

unlink 'TEMP_TEST_OUTPUT.png'
