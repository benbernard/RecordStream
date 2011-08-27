use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use Recs::Record;

BEGIN { use_ok("Recs::Aggregator::DistinctCount"); }

ok(my $aggr = Recs::Aggregator::DistinctCount->new("x"), "Initialize");

do_test(6, 'C', 'B', 'F', 'J', 'A', 'C', 'D', 'D');
do_test(5, 'B', 'I', 'D', 'J', 'A', 'A', 'B');
do_test(6, 'E', 'D', 'E', 'A', 'A', 'G', 'D', 'C', 'B');
do_test(5, 'C', 'B', 'J', 'C', 'B', 'A', 'I');
do_test(5, 'E', 'I', 'F', 'E', 'H', 'I', 'F', 'H', 'A');
do_test(6, 'I', 'H', 'H', 'D', 'B', 'J', 'B', 'A', 'A');
do_test(4, 'G', 'F', 'E', 'E', 'H', 'E', 'F');
do_test(6, 'B', 'G', 'H', 'D', 'G', 'F', 'D', 'E');
do_test(5, 'J', 'A', 'G', 'J', 'G', 'A', 'H', 'I');

sub do_test
{
   my ($ans, @v) = @_;

   my $cookie = $aggr->initial();

   foreach my $v (@v)
   {
      $cookie = $aggr->combine($cookie, Recs::Record->new("x" => $v));
   }

   my $value = $aggr->squish($cookie);

   is($value, $ans, "distinct count of " . join(", ", @v));
}

{
   ok(my $aggr = Recs::Aggregator::DistinctCount->new("x"), "Initialize");

   my $cookie = $aggr->initial();

   foreach my $n ("baba", "zhaba", "zhaba", "tochak", "baba", "zhaba")
   {
      $cookie = $aggr->combine($cookie, Recs::Record->new("x" => $n));
   }

   my $value = $aggr->squish($cookie);

   is($value, 3, "dct of baba, zhaba, zhaba, tochak, baba, zhaba");
}
