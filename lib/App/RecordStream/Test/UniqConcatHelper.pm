package App::RecordStream::Test::UniqConcatHelper;

use strict;
use warnings;

use App::RecordStream::Record;

sub test_aggregator
{
   my $aggr = shift;
   my $delim = shift;
   my $field = shift;

   my $cookie = $aggr->initial();

   foreach my $n (1, 3, 3, 1, 2, 7)
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
   }

   my $value = $aggr->squish($cookie);

   Test::More::is($value, '1,2,3,7', "uniq concat of 1, 3, 3, 1, 2, 7");
}

1;
