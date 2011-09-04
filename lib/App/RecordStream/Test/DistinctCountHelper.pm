package App::RecordStream::Test::DistinctCountHelper;

use strict;
use warnings;

use App::RecordStream::Record;

sub test_aggregator
{
   my $aggr = shift;
   my $field = shift;

   do_test($aggr, $field, 6, 'C', 'B', 'F', 'J', 'A', 'C', 'D', 'D');
   do_test($aggr, $field, 5, 'B', 'I', 'D', 'J', 'A', 'A', 'B');
   do_test($aggr, $field, 6, 'E', 'D', 'E', 'A', 'A', 'G', 'D', 'C', 'B');
   do_test($aggr, $field, 5, 'C', 'B', 'J', 'C', 'B', 'A', 'I');
   do_test($aggr, $field, 5, 'E', 'I', 'F', 'E', 'H', 'I', 'F', 'H', 'A');
   do_test($aggr, $field, 6, 'I', 'H', 'H', 'D', 'B', 'J', 'B', 'A', 'A');
   do_test($aggr, $field, 4, 'G', 'F', 'E', 'E', 'H', 'E', 'F');
   do_test($aggr, $field, 6, 'B', 'G', 'H', 'D', 'G', 'F', 'D', 'E');
   do_test($aggr, $field, 5, 'J', 'A', 'G', 'J', 'G', 'A', 'H', 'I');

   {
       my $cookie = $aggr->initial();

       foreach my $n ("baba", "zhaba", "zhaba", "tochak", "baba", "zhaba")
       {
           $cookie = $aggr->combine($cookie, App::RecordStream::Record->new($field => $n));
       }

       my $value = $aggr->squish($cookie);

       Test::More::is($value, 3, "dct of baba, zhaba, zhaba, tochak, baba, zhaba");
   }
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

   Test::More::is($value, $ans, "distinct count of " . join(", ", @v));
}

1;
