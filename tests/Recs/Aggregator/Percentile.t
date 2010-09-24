use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use Recs::Record;

BEGIN { use_ok("Recs::Aggregator::Percentile"); }

ok(my $aggr = Recs::Aggregator::Percentile->new(90, "x"), "Initialize");
is(percentile_100_values($aggr), 91, "90th percentile of 1-100");

ok($aggr = Recs::Aggregator::Percentile->new(100, "x"), "Initialize");
is(percentile_100_values($aggr), 100, "100th percentile of 1-100");

sub percentile_100_values {
   my $aggr = shift;

   my $cookie = $aggr->initial();

   foreach my $n (1..100)
   {
      $cookie = $aggr->combine($cookie, Recs::Record->new("x" => $n));
   }

   return $aggr->squish($cookie);
}
