use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::Covariance"); }
BEGIN { use_ok("App::RecordStream::Record"); }

{
   my $aggr = App::RecordStream::Aggregator::Covariance->new("x", "y");

   my $cookie = $aggr->initial();

   foreach my $r ([1, 2], [3, 4], [5, 7])
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $r->[0], "y" => $r->[1]));
   }

   my $value = $aggr->squish($cookie);

   is($value, 10 / 3, "covariance for (1, 2), (3, 4), (5, 7)");
}

{
   my $aggr = App::RecordStream::Aggregator::Covariance->new("x", "y");

   my $cookie = $aggr->initial();

   foreach my $r ([1, 1], [2, 2], [5, 3], [4, 4], [7, 5], [8, 6], [9, 7], [10, 8], [10, 9], [12, 10])
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $r->[0], "y" => $r->[1]));
   }

   my $value = $aggr->squish($cookie);

   is($value, 9.8, "covariance for (1, 1), (2, 2), (5, 3), (4, 4), (7, 5), (8, 6), (9, 7), (10, 8), (10, 9), (12, 10)");
}
