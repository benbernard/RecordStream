use strict;
use warnings;
use Test::More;
use File::Basename 'basename';
use JSON::MaybeXS 'decode_json';

my $recs = "$ENV{BASE_TEST_DIR}/../recs";

plan 'skip_all', "$recs must exist and be executable and lib::core::only must be installed"
  unless -x $recs and eval { require lib::core::only; 1 };

# test loading of both Text::CSV_PP and JSON::PP
is_deeply decode_json(fatpack_ok('fromcsv <<<foo,bar,baz')), { 0 => "foo", 1 => "bar", 2 => "baz" }, 'json matches';

# test operation discovery
my @listed_ops = split /\n/, fatpack_ok('-l');
my %core_ops   = map {; basename($_, '.pm') => 1 } <$ENV{BASE_TEST_DIR}/../lib/App/RecordStream/Operation/*.pm>;
delete $core_ops{$_} for @listed_ops;
ok !keys %core_ops, '-l outputs all the core ops'
  or diag "missing core ops: " . join(", ", sort keys %core_ops);

# test aggregator (BaseRegistry) discovery
is fatpack_ok('collate -a count <<<"{}"'), '{"count":1}', 'json matches';

sub fatpack_ok {
  my $cmd = join ' ', $^X, '-Mlib::core::only', $recs, @_;
  my $out = `$cmd`;
  ok $? == 0, "$cmd"
    or diag sprintf "exited %d (%s)", $? >> 8, $!;
  chomp $out;
  return $out;
}

done_testing;
