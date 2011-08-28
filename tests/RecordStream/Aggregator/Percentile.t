use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::Aggregator::Percentile"); }

ok(my $aggr = App::RecordStream::Aggregator::Percentile->new(90, "x"), "Initialize");
is(percentile_100_values($aggr), 91, "90th percentile of 1-100");

ok($aggr = App::RecordStream::Aggregator::Percentile->new(100, "x"), "Initialize");
is(percentile_100_values($aggr), 100, "100th percentile of 1-100");

sub percentile_100_values {
   my $aggr = shift;

   my $cookie = $aggr->initial();

   foreach my $n (1..100)
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
   }

   return $aggr->squish($cookie);
}
