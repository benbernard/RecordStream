use Test::More;
use App::RecordStream::Test::OperationHelper 'fromdb';

# OperationHelper will catch fromdb's DBI requirement, but we require SQLite
# for testing too.
plan skip_all => 'DBD::SQLite needed to run tests'
  unless eval { require DBD::SQLite; };

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

done_testing;
