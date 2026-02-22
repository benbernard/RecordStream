use Test::More;
use IO::String;
use Data::Dumper;

plan skip_all => 'DBI and DBD::SQLite needed to run tests'
  unless eval { require DBI; require DBD::SQLite; 1 };

require App::RecordStream::DBHandle;

my $db_file = $ENV{'BASE_TEST_DIR'} . '/files/testDb';

@ARGV = ('--type', 'sqlite', '--dbfile', $db_file, 'foo');

ok(App::RecordStream::DBHandle::get_dbh(), 'Get a databasehandle');
is_deeply(['foo'], \@ARGV, 'get_dbh cleared ARGV, leaving extra args');

unlink $db_file;

done_testing;
