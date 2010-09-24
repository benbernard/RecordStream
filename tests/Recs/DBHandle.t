use Test::More qw(no_plan);
use IO::String;
use Data::Dumper;

my $base_dir = $ENV{'BASE_TEST_DIR'} . '/Recs';

BEGIN { use_ok( 'Recs::DBHandle' ) };

my $db_file = $base_dir . '/testDb';

@ARGV = ('--type', 'sqlite', '--dbfile', $db_file, 'foo');

ok(Recs::DBHandle::get_dbh(), 'Get a databasehandle');
is_deeply(['foo'], \@ARGV, 'get_dbh cleared ARGV, leaving extra args');

unlink $db_file
