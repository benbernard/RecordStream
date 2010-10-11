use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::xform' ) };

my $input = <<INPUT;
{"a":"a1,a2","b":"b1"}
{"a":"a3,a4,a5","b":"b2"}
INPUT

my $xform;
my $output;

$xform = Recs::Operation::xform->new(['$r->{a} = "a0";']),
$output = <<OUTPUT;
{"a":"a0","b":"b1"}
{"a":"a0","b":"b2"}
OUTPUT
Recs::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();

$xform = Recs::Operation::xform->new(['$r->{a} = "a0"; [{}]']);
$output = <<OUTPUT;
{}
{}
OUTPUT
Recs::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();

$xform = Recs::Operation::xform->new(['[map { {%$r, "a" => $_} } split(/,/, delete($r->{"a"}))]']);
$output = <<OUTPUT;
{"a":"a1","b":"b1"}
{"a":"a2","b":"b1"}
{"a":"a3","b":"b2"}
{"a":"a4","b":"b2"}
{"a":"a5","b":"b2"}
OUTPUT
Recs::Test::OperationHelper->new("operation" => $xform, "input" => $input, "output" => $output)->matches();
