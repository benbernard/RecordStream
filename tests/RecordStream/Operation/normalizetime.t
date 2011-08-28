use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::normalizetime' ) };

my $stream = <<STREAM;
{"date":"2009 Jun 12 1:00:00 UTC"}
{"date":"2009 Jun 12 1:00:14 UTC"}
{"date":"2009 Jun 12 1:00:59 UTC"}
{"date":"2009 Jun 12 1:02:05 UTC"}
{"date":"2009 Jun 12 1:02:55 UTC"}
{"date":"2009 Jun 12 1:03:15 UTC"}
STREAM

my $solution = <<SOLUTION;
{"n_date":1244768400,"date":"2009 Jun 12 1:00:00 UTC"}
{"n_date":1244768400,"date":"2009 Jun 12 1:00:14 UTC"}
{"n_date":1244768400,"date":"2009 Jun 12 1:00:59 UTC"}
{"n_date":1244768520,"date":"2009 Jun 12 1:02:05 UTC"}
{"n_date":1244768520,"date":"2009 Jun 12 1:02:55 UTC"}
{"n_date":1244768580,"date":"2009 Jun 12 1:03:15 UTC"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'normalizetime',
   [ qw(--strict --n 60 --key date) ],
   $stream,
   $solution,
);

$solution = <<SOLUTION;
{"n_date":1244768400,"date":"2009 Jun 12 1:00:00 UTC"}
{"n_date":1244768400,"date":"2009 Jun 12 1:00:14 UTC"}
{"n_date":1244768400,"date":"2009 Jun 12 1:00:59 UTC"}
{"n_date":1244768520,"date":"2009 Jun 12 1:02:05 UTC"}
{"n_date":1244768520,"date":"2009 Jun 12 1:02:55 UTC"}
{"n_date":1244768520,"date":"2009 Jun 12 1:03:15 UTC"}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
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

App::RecordStream::Test::OperationHelper->do_match(
   'normalizetime',
   [ qw(--n 60 --key date --epoch) ],
   $stream,
   $solution,
);

