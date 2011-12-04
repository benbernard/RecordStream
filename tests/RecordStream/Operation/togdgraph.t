use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::togdgraph' ) };

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
type: scatter
width: 600
height: 300
output file: TEMP-gd.png
field: uid
field: ct
syslog 1
messagebus 1
avahi 2
daemon 1
gdm 1
rtkit 1
haldaemon 2
root 75
bernard 58
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
  'togdgraph',
  ['--key', 'uid,ct', '--png-file', 'TEMP-gd.png', '--dump-use-spec'],
  $stream,
  $solution,
);

unlink 'TEMP-gd.png'
