use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use Recs::Record;

BEGIN { use_ok("Recs::Aggregator::Minimum"); }

ok(my $aggr = Recs::Aggregator::Minimum->new("x"), "Initialize");

do_test(1, 1, 3, 7);
do_test(1, 1, 7, 3);
do_test(1, 3, 1, 7);
do_test(1, 3, 7, 1);
do_test(1, 7, 1, 3);
do_test(1, 7, 3, 1);

sub do_test
{
   my ($min, @n) = @_;

   my $cookie = $aggr->initial();

   foreach my $n (@n)
   {
      $cookie = $aggr->combine($cookie, Recs::Record->new("x" => $n));
   }

   my $value = $aggr->squish($cookie);

   is($value, $min, "min of " . join(", ", @n));
}
