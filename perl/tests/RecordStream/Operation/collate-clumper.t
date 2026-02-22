use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::collate' ) };

{
  my $input = <<STREAM;
{"a":"a1","b":"b1"}
{"a":"a1","b":"b2"}
{"a":"a2","b":"b1"}
{"a":"a2","b":"b2"}
STREAM

  my $output = <<SOLUTION;
{"a":"a1","b":"b1","ct":2}
{"a":"a1","b":"b2","ct":2}
{"a":"a2","b":"b1","ct":2}
{"a":"a2","b":"b2","ct":2}
SOLUTION

  App::RecordStream::Test::OperationHelper->do_match(
    'collate',
    ['-c', 'keylru,a,2', '-c', 'keylru,b,2', '-a', 'ct'],
    ($input x 2),
    $output,
  );
}

{
  my $input = <<STREAM;
{"a":"a1","b":"b1"}
{"a":"a1","b":"b2"}
{"a":"a1","b":"b3"}
{"a":"a2","b":"b1"}
{"a":"a2","b":"b2"}
{"a":"a2","b":"b3"}
{"a":"a3","b":"b1"}
{"a":"a3","b":"b2"}
{"a":"a3","b":"b3"}
STREAM

  my $output = <<SOLUTION;
{"a":"a1","b":"b1","ct":1}
{"a":"a2","b":"b1","ct":1}
{"a":"a1","b":"b2","ct":1}
{"a":"a1","b":"b3","ct":1}
{"a":"a3","b":"b1","ct":1}
{"a":"a2","b":"b2","ct":1}
{"a":"a2","b":"b3","ct":1}
{"a":"a1","b":"b1","ct":1}
{"a":"a3","b":"b2","ct":1}
{"a":"a3","b":"b3","ct":1}
{"a":"a2","b":"b1","ct":1}
{"a":"a1","b":"b2","ct":1}
{"a":"a1","b":"b3","ct":1}
{"a":"a3","b":"b1","ct":1}
{"a":"a2","b":"b2","ct":1}
{"a":"a2","b":"b3","ct":1}
{"a":"a3","b":"b2","ct":1}
{"a":"a3","b":"b3","ct":1}
SOLUTION

  App::RecordStream::Test::OperationHelper->do_match(
    'collate',
    ['-c', 'keylru,a,2', '-c', 'keylru,b,2', '-a', 'ct'],
    ($input x 2),
    $output,
  );
}

{
  my $input = <<STREAM;
{"x":1}
{"x":2}
{"x":3}
{"x":4}
{"x":5}
{"x":6}
{"x":7}
{"x":8}
{"x":9}
STREAM

  my $output = <<SOLUTION;
{"sum_x":6,"ct":3}
{"sum_x":9,"ct":3}
{"sum_x":12,"ct":3}
{"sum_x":15,"ct":3}
{"sum_x":18,"ct":3}
{"sum_x":21,"ct":3}
{"sum_x":24,"ct":3}
SOLUTION

  App::RecordStream::Test::OperationHelper->do_match(
    'collate',
    ['-c', 'window,3', '-a', 'sum,x', '-a', 'ct'],
    $input,
    $output,
  );
}

{
  my $input = <<STREAM;
{"a":"a1","x":1}
{"a":"a1","x":2}
{"a":"a1","x":3}
{"a":"a1","x":4}
{"a":"a2","x":5}
{"a":"a1","x":6}
{"a":"a1","x":7}
{"a":"a2","x":8}
{"a":"a2","x":9}
{"a":"a2","x":10}
STREAM

  my $output = <<SOLUTION;
{"a":"a1","sum_x":6,"ct":3}
{"a":"a1","sum_x":9,"ct":3}
{"a":"a2","sum_x":27,"ct":3}
SOLUTION

  App::RecordStream::Test::OperationHelper->do_match(
    'collate',
    ['-c', 'keylru,a,1', '-c', 'window,3', '-a', 'sum,x', '-a', 'ct'],
    $input,
    $output,
  );
}

{
  my $input = <<STREAM;
{"a":"a1","x":1}
{"a":"a1","x":2}
{"a":"a1","x":3}
{"a":"a1","x":4}
{"a":"a2","x":5}
{"a":"a1","x":6}
{"a":"a1","x":7}
{"a":"a2","x":8}
{"a":"a2","x":9}
{"a":"a2","x":10}
STREAM

  my $output = <<SOLUTION;
{"a":"a1","sum_x":23,"ct":6}
{"a":"a2","sum_x":32,"ct":4}
SOLUTION

  App::RecordStream::Test::OperationHelper->do_match(
    'collate',
    ['-c', 'keyperfect,a', '-a', 'sum,x', '-a', 'ct'],
    $input,
    $output,
  );
}

# other order!
{
  my $input = <<STREAM;
{"a":"a2"}
{"a":"a1"}
STREAM

  my $output = <<SOLUTION;
{"a":"a2","ct":1}
{"a":"a1","ct":1}
SOLUTION

  App::RecordStream::Test::OperationHelper->do_match(
    'collate',
    ['-c', 'keyperfect,a', '-a', 'ct'],
    $input,
    $output,
  );
}
