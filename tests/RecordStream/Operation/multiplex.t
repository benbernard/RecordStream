use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Operation::multiplex' ) };

my $stream = <<STREAM;
{"l":"T=1,A=A1","t":"1"}
{"l":"T=1,B=B1","t":"1"}
{"l":"T=2,A=A3","t":"2"}
{"l":"T=1,A=A2","t":"1"}
{"l":"T=2,B=B3","t":"2"}
{"l":"T=1,B=B2","t":"1"}
{"l":"T=2,A=A4","t":"2"}
{"l":"T=2,B=B4","t":"2"}
STREAM

my $solution = <<SOLUTION;
{"a":"A1","b":"B1","t":1}
{"a":"A3","b":"B3","t":2}
{"a":"A2","b":"B2","t":1}
{"a":"A4","b":"B4","t":2}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'multiplex',
  [qw(-k t -L l -- recs-frommultire --re), 'a=^T=.*,A=(.*)$', '--re', 'b=^T=.*,B=(.*)$'],
  $stream,
  $solution,
);

my $solution2 = <<SOLUTION;
{"l":"T=1,A=A1","t":"1","u":"booga","c":1}
{"l":"T=1,B=B1","t":"1","u":"booga","c":2}
{"l":"T=2,A=A3","t":"2","u":"booga","c":1}
{"l":"T=1,A=A2","t":"1","u":"booga","c":3}
{"l":"T=2,B=B3","t":"2","u":"booga","c":2}
{"l":"T=1,B=B2","t":"1","u":"booga","c":4}
{"l":"T=2,A=A4","t":"2","u":"booga","c":3}
{"l":"T=2,B=B4","t":"2","u":"booga","c":4}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'multiplex',
  [qw(-k t -- recs-xform), '{{c}} = ++$c; {{t}} = "ooga"; {{u}} = "booga"'],
  $stream,
  $solution2,
);

my $solution3 = <<SOLUTION;
1 T=1,A=A1
2 T=1,B=B1
1 T=2,A=A3
3 T=1,A=A2
2 T=2,B=B3
4 T=1,B=B2
3 T=2,A=A4
4 T=2,B=B4
SOLUTION

App::RecordStream::Test::OperationHelper->test_output(
  'multiplex',
  [qw(-k t -- recs-eval), '$c++; "$c {{l}}"'],
  $stream,
  $solution3,
);

my $solution4 = <<SOLUTION;
{"t":1,"ct":4}
{"t":2,"ct":4}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
  'multiplex',
  [qw(-k t -- recs-collate -a ct)],
  $stream,
  $solution4,
);
