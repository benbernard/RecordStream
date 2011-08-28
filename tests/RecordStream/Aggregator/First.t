use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::Aggregator::First"); }

ok(my $aggr = App::RecordStream::Aggregator::First->new("x"), "Initialize");

do_test('C', 'C', 'B', 'F', 'J', 'A', 'C', 'D', 'D');
do_test('B', 'B', 'I', 'D', 'J', 'A', 'A', 'B');
do_test('E', 'E', 'D', 'E', 'A', 'A', 'G', 'D', 'C', 'B');
do_test('C', 'C', 'B', 'J', 'C', 'B', 'A', 'I');
do_test('E', 'E', 'I', 'F', 'E', 'H', 'I', 'F', 'H', 'A');
do_test('I', 'I', 'H', 'H', 'D', 'B', 'J', 'B', 'A', 'A');
do_test('G', 'G', 'F', 'E', 'E', 'H', 'E', 'F');
do_test('B', 'B', 'G', 'H', 'D', 'G', 'F', 'D', 'E');
do_test('J', 'J', 'A', 'G', 'J', 'G', 'A', 'H', 'I');

sub do_test
{
   my ($ans, @v) = @_;

   my $cookie = $aggr->initial();

   foreach my $v (@v)
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $v));
   }

   my $value = $aggr->squish($cookie);

   is($value, $ans, "first of " . join(", ", @v));
}
