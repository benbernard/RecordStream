use strict;
use warnings;

use Test::More;
use App::RecordStream::Test::OperationHelper;
use App::RecordStream::Operation::tojsonarray;

my ($input, $output);

# Basic
$input = <<'INPUT';
{"a":1,"foo":"bar"}
{"a":2,"b":2}
{"c":3}
{"b":4}
INPUT

$output = <<'OUTPUT';
[{"a":1,"foo":"bar"}
,{"a":2,"b":2}
,{"c":3}
,{"b":4}
]
OUTPUT

App::RecordStream::Test::OperationHelper->test_output('tojsonarray', [], $input, $output);


# Empty
$input  = "";
$output = "[]\n";
App::RecordStream::Test::OperationHelper->test_output('tojsonarray', [], $input, $output);


done_testing;
