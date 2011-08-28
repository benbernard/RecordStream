use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::Aggregator::Maximum"); }

ok(my $aggr = App::RecordStream::Aggregator::Maximum->new("x"), "Initialize");

do_test(7, 1, 3, 7);
do_test(7, 1, 7, 3);
do_test(7, 3, 1, 7);
do_test(7, 3, 7, 1);
do_test(7, 7, 1, 3);
do_test(7, 7, 3, 1);

sub do_test
{
   my ($max, @n) = @_;

   my $cookie = $aggr->initial();

   foreach my $n (@n)
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
   }

   my $value = $aggr->squish($cookie);

   is($value, $max, "max of " . join(", ", @n));
}
