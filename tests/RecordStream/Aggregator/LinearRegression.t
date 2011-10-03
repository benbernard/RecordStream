use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::LinearRegression"); }
BEGIN { use_ok("App::RecordStream::Record"); }

{
   my $aggr = App::RecordStream::Aggregator::LinearRegression->new("x", "y");

   my $cookie = $aggr->initial();

   foreach my $r ([1, 2], [3, 4], [5, 7])
   {
      $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $r->[0], "y" => $r->[1]));
   }

   my $value = $aggr->squish($cookie);

   my $ans =
   {
      'beta' => 5 / 4,
      'alpha' => 7 / 12,
      'alpha_se' => sqrt(2.1875 / 9),
      'beta_se' => sqrt(0.0625 / 3),
   };

   for my $key (keys(%$ans))
   {
      my $e = $ans->{$key};
      my $o = delete($value->{$key});

      if(!defined($o))
      {
         fail("Missing key $key (expected $e) in linear regression for (1, 2), (3, 4), (5, 7)");
      }
      if($o == $e)
      {
         # mostly for 0
         next;
      }
      if($e == 0)
      {
         fail("Bad zero key $key in linear regression for (1, 2), (3, 4), (5, 7)");
      }
      if(abs($o - $e) / $e < 1e-10)
      {
         next;
      }
      fail("Mismatch key $key (observed $o, expected $e) in linear regression for (1, 2), (3, 4), (5, 7)");
   }

   for my $key (keys(%$value))
   {
      fail("Unexpected key $key (observed " . $value->{$key} . ") in linear regression for (1, 2), (3, 4), (5, 7)");
   }
}
