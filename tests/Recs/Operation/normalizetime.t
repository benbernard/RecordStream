use Test::More qw(no_plan);
use Recs::Test::OperationHelper;

BEGIN { use_ok( 'Recs::Operation::normalizetime' ) };

my $stream = <<STREAM;
{"date":"2009 Jun 12 1:00:00"}
{"date":"2009 Jun 12 1:00:14"}
{"date":"2009 Jun 12 1:00:59"}
{"date":"2009 Jun 12 1:02:05"}
{"date":"2009 Jun 12 1:02:55"}
{"date":"2009 Jun 12 1:03:15"}
STREAM

my $solution = <<SOLUTION;
{"n_date":1244793600,"date":"2009 Jun 12 1:00:00"}
{"n_date":1244793600,"date":"2009 Jun 12 1:00:14"}
{"n_date":1244793600,"date":"2009 Jun 12 1:00:59"}
{"n_date":1244793720,"date":"2009 Jun 12 1:02:05"}
{"n_date":1244793720,"date":"2009 Jun 12 1:02:55"}
{"n_date":1244793780,"date":"2009 Jun 12 1:03:15"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'normalizetime',
   [ qw(--strict --n 60 --key date) ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"n_date":1244793600,"date":"2009 Jun 12 1:00:00"}
{"n_date":1244793600,"date":"2009 Jun 12 1:00:14"}
{"n_date":1244793600,"date":"2009 Jun 12 1:00:59"}
{"n_date":1244793720,"date":"2009 Jun 12 1:02:05"}
{"n_date":1244793720,"date":"2009 Jun 12 1:02:55"}
{"n_date":1244793720,"date":"2009 Jun 12 1:03:15"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'normalizetime',
   [ qw(--n 60 --key date) ],
   $stream,
   $solution,
);

$stream = <<STREAM;
{"date":"1"}
{"date":"63"}
{"date":"80"}
{"date":"120"}
{"date":"145"}
STREAM

$solution = <<SOLUTION;
{"n_date":0,"date":"1"}
{"n_date":0,"date":"63"}
{"n_date":0,"date":"80"}
{"n_date":120,"date":"120"}
{"n_date":120,"date":"145"}
SOLUTION

Recs::Test::OperationHelper->do_match(
   'normalizetime',
   [ qw(--n 60 --key date --epoch) ],
   $stream,
   $solution,
);

