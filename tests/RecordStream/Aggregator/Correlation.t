use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::Correlation"); }
BEGIN { use_ok("App::RecordStream::Record"); }

{
   my $aggr = App::RecordStream::Aggregator::Correlation->new("x", "y");

   my $cookie = $aggr->initial();

   foreach my $r ([1, 2], [3, 4], [5, 7])
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $r->[0], "y" => $r->[1]));
   }

   my $value = $aggr->squish($cookie);

   is($value, (5 * sqrt(3)) / (2 * sqrt(19)), "correlation for (1, 2), (3, 4), (5, 7)");
}

{
   my $aggr = App::RecordStream::Aggregator::Correlation->new("x", "y");

   my $cookie = $aggr->initial();

   foreach my $r ([1, 1], [2, 2], [5, 3], [4, 4], [7, 5], [8, 6], [9, 7], [10, 8], [10, 9], [12, 10])
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $r->[0], "y" => $r->[1]));
   }

   my $value = $aggr->squish($cookie);

   is($value, (98 / 10) / sqrt((33 / 4) * (304 / 25)), "correlation for (1, 1), (2, 2), (5, 3), (4, 4), (7, 5), (8, 6), (9, 7), (10, 8), (10, 9), (12, 10)");
}
