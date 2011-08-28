use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

BEGIN { use_ok( 'App::RecordStream::Operation::fromdb' ) };

my $solution = <<SOLUTION;
{"foo":"1","id":1}
{"foo":"2","id":2}
{"foo":"3","id":3}
{"foo":"4","id":4}
{"foo":"5","id":5}
{"foo":"6","id":6}
{"foo":"7","id":7}
{"foo":"8","id":8}
{"foo":"9","id":9}
{"foo":"10","id":10}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'fromdb',
   [ qw(--dbfile tests/files/sqliteDB --table recs) ],
   '',
   $solution,
);

$solution = <<SOLUTION;
{"foo":"6","id":6}
{"foo":"7","id":7}
{"foo":"8","id":8}
{"foo":"9","id":9}
SOLUTION

App::RecordStream::Test::OperationHelper->do_match(
   'fromdb',
   [ qw(--dbfile tests/files/sqliteDB --sql), 'select * from recs where foo > 5' ],
   '',
   $solution,
);

