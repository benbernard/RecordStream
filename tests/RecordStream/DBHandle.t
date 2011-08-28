use Test::More qw(no_plan);
use IO::String;
use Data::Dumper;

BEGIN { use_ok( 'App::RecordStream::DBHandle' ) };

my $db_file = $ENV{'BASE_TEST_DIR'} . '/files/testDb';

@ARGV = ('--type', 'sqlite', '--dbfile', $db_file, 'foo');

ok(App::RecordStream::DBHandle::get_dbh(), 'Get a databasehandle');
is_deeply(['foo'], \@ARGV, 'get_dbh cleared ARGV, leaving extra args');

unlink $db_file
