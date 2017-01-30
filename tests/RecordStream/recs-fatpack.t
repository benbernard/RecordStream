use strict;
use warnings;
use Test::More;
use File::Basename 'basename';
use JSON::MaybeXS 'decode_json';
use IPC::Open2;

my ($recs) = grep { -e } map { "$_/recs" }
  "$ENV{BASE_TEST_DIR}/..", $ENV{DZIL_ROOT_DIR};

my ($recs_original) = grep { -e } map { "$_/recs" }
  "$ENV{BASE_TEST_DIR}/../bin", "$ENV{DZIL_ROOT_DIR}/scripts";

plan 'skip_all', "both versions of recs must exist and lib::core::only must be installed"
  unless $recs and $recs_original and eval { require lib::core::only; 1 };

# check that version reports fatpack status correctly
like   fatpack_ok("--version"),                qr/fatpacked/, "fatpacked version reports fatpacked";
unlike run_ok("$^X $recs_original --version"), qr/fatpacked/, "original version does not report fatpacked";

# test loading of both Text::CSV_PP and JSON::PP
is_deeply decode_json(fatpack_ok('fromcsv', { stdin => 'foo,bar,baz' })), { 0 => "foo", 1 => "bar", 2 => "baz" }, 'json matches';

# test operation discovery
my @listed_ops = split /\n/, fatpack_ok('-l');
my %core_ops   = map {; basename($_, '.pm') => 1 } <$ENV{BASE_TEST_DIR}/../lib/App/RecordStream/Operation/*.pm>;
delete $core_ops{$_} for @listed_ops;
ok !keys %core_ops, '-l outputs all the core ops'
  or diag "missing core ops: " . join(", ", sort keys %core_ops);

# test aggregator (BaseRegistry) discovery
is fatpack_ok('collate -a count', { stdin => '{}' }), '{"count":1}', 'json matches';

# test running of external scripts, with standalone path and -- delimiter
my $script = "$ENV{'BASE_TEST_DIR'}/files/load-test.pl";
like fatpack_ok($script),       qr/^FatPacked::/, 'loaded module from fatpack';
like fatpack_ok("--", $script), qr/^FatPacked::/, 'loaded module from fatpack';

# test running of external scripts, with args
is fatpack_ok("--", $script, qw[ foo bar baz ]), 'foo bar baz', 'args passed';


sub fatpack_ok {
  my $opt = ref $_[-1] eq 'HASH' ? pop @_ : {};
  my $cmd = join ' ', $^X, '-Mlib::core::only', $recs, @_;
  return run_ok($cmd, $opt);
}

sub run_ok {
  my $cmd = shift;
  my $opt = shift || {};
  my $pid = open2(my $stdout, my $stdin, $cmd);

  print { $stdin } $opt->{stdin}, "\n" if defined $opt->{stdin};
  close $stdin;

  my $out = do { local $/; <$stdout> };
  close $stdout;

  waitpid($pid, 0);
  ok $? == 0, "$cmd"
    or diag sprintf "exited %d (%s)", $? >> 8, $!;

  chomp $out;
  return $out;
}

done_testing;
