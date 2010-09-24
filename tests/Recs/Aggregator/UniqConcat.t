use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("Recs::Aggregator::UniqConcatenate"); }
BEGIN { use_ok("Recs::Record"); }

my $aggr = Recs::Aggregator::UniqConcatenate->new(',',"x");

my $cookie = $aggr->initial();

foreach my $n (1, 3, 3, 1, 2, 7)
{
   $cookie = $aggr->combine($cookie, Recs::Record->new("x" => $n));
}

my $value = $aggr->squish($cookie);

is($value, '1,2,3,7', "uniq concat of 1, 3, 3, 1, 2, 7");
