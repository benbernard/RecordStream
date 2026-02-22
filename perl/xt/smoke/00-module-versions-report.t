use strict;
use warnings;
use Test::More;
use Module::Versions::Report ();
use App::RecordStream;

diag "\n";

# Load up all our packages, so our deps get loaded, but it doesn't really
# matter if we can't load something since there are optional deps.
for (App::RecordStream->operation_packages) {
  local *STDOUT = *STDOUT;
  local *STDERR = *STDERR;
  close STDOUT;
  close STDERR;
  eval "require $_; 1"
    or diag "Couldn't load $_, but that's ok";
}

# Report on what we got, for test diagnostics
diag $_ for
  grep { not /Eval::Closure::Sandbox/ }
  split /\n/,
  Module::Versions::Report::report();

ok 1;
done_testing;
