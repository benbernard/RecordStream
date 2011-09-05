use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::xform' ) };

my $input = <<INPUT;
{"a":"a1,a2","b":"b1"}
{"a":"a3,a4,a5","b":"b2"}
INPUT

my $xform;
my $output;

$xform = App::RecordStream::Operation::xform->new(['$r->{a} = "a0";']),
$output = <<OUTPUT;
{"a":"a0","b":"b1"}
{"a":"a0","b":"b2"}
OUTPUT
App::RecordStream::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();

$xform = App::RecordStream::Operation::xform->new(['$r->{a} = "a0"; [{}]']),
$output = <<OUTPUT;
{"a":"a0","b":"b1"}
{"a":"a0","b":"b2"}
OUTPUT
App::RecordStream::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();

$xform = App::RecordStream::Operation::xform->new(['$r->{a} = "a0"; $r = [{}]']);
$output = <<OUTPUT;
{}
{}
OUTPUT
App::RecordStream::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();

$xform = App::RecordStream::Operation::xform->new(['-e', '$r = [map { {%$r, "a" => $_} } split(/,/, delete($r->{"a"}))]; 1;']);
$output = <<OUTPUT;
{"a":"a1","b":"b1"}
{"a":"a2","b":"b1"}
{"a":"a3","b":"b2"}
{"a":"a4","b":"b2"}
{"a":"a5","b":"b2"}
OUTPUT
App::RecordStream::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();

$xform = App::RecordStream::Operation::xform->new(['-E', 'tests/files/executorCode']);
$output = <<OUTPUT;
{"a":"a1,a2","b":"b1","foo":"bar"}
{"a":"a3,a4,a5","b":"b2","foo":"bar"}
OUTPUT
App::RecordStream::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();
