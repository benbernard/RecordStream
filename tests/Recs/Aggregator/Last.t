use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use Recs::Record;

BEGIN { use_ok("Recs::Aggregator::Last"); }

ok(my $aggr = Recs::Aggregator::Last->new("x"), "Initialize");

do_test('D', 'C', 'B', 'F', 'J', 'A', 'C', 'D', 'D');
do_test('B', 'B', 'I', 'D', 'J', 'A', 'A', 'B');
do_test('B', 'E', 'D', 'E', 'A', 'A', 'G', 'D', 'C', 'B');
do_test('I', 'C', 'B', 'J', 'C', 'B', 'A', 'I');
do_test('A', 'E', 'I', 'F', 'E', 'H', 'I', 'F', 'H', 'A');
do_test('A', 'I', 'H', 'H', 'D', 'B', 'J', 'B', 'A', 'A');
do_test('F', 'G', 'F', 'E', 'E', 'H', 'E', 'F');
do_test('E', 'B', 'G', 'H', 'D', 'G', 'F', 'D', 'E');
do_test('I', 'J', 'A', 'G', 'J', 'G', 'A', 'H', 'I');

sub do_test
{
   my ($ans, @v) = @_;

   my $cookie = $aggr->initial();

   foreach my $v (@v)
   {
      $cookie = $aggr->combine($cookie, Recs::Record->new("x" => $v));
   }

   my $value = $aggr->squish($cookie);

   is($value, $ans, "first of " . join(", ", @v));
}
