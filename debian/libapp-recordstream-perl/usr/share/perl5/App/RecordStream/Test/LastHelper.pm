package App::RecordStream::Test::LastHelper;

use strict;
use warnings;

use App::RecordStream::Record;

sub test_aggregator
{
   my $aggr = shift;
   my $field = shift;

   do_test($aggr, $field, 'D', 'C', 'B', 'F', 'J', 'A', 'C', 'D', 'D');
   do_test($aggr, $field, 'B', 'B', 'I', 'D', 'J', 'A', 'A', 'B');
   do_test($aggr, $field, 'B', 'E', 'D', 'E', 'A', 'A', 'G', 'D', 'C', 'B');
   do_test($aggr, $field, 'I', 'C', 'B', 'J', 'C', 'B', 'A', 'I');
   do_test($aggr, $field, 'A', 'E', 'I', 'F', 'E', 'H', 'I', 'F', 'H', 'A');
   do_test($aggr, $field, 'A', 'I', 'H', 'H', 'D', 'B', 'J', 'B', 'A', 'A');
   do_test($aggr, $field, 'F', 'G', 'F', 'E', 'E', 'H', 'E', 'F');
   do_test($aggr, $field, 'E', 'B', 'G', 'H', 'D', 'G', 'F', 'D', 'E');
   do_test($aggr, $field, 'I', 'J', 'A', 'G', 'J', 'G', 'A', 'H', 'I');
}

sub do_test
{
   my $aggr = shift;
   my $field = shift;
   my $ans = shift;
   my @v = @_;

   my $cookie = $aggr->initial();

   foreach my $v (@v)
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new($field => $v));
   }

   my $value = $aggr->squish($cookie);

   Test::More::is($value, $ans, "last of " . join(", ", @v));
}

1;
