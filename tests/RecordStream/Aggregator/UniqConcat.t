use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::UniqConcatenate"); }
BEGIN { use_ok("App::RecordStream::Record"); }

my $aggr = App::RecordStream::Aggregator::UniqConcatenate->new(',',"x");

my $cookie = $aggr->initial();

foreach my $n (1, 3, 3, 1, 2, 7)
{
   $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
}

my $value = $aggr->squish($cookie);

is($value, '1,2,3,7', "uniq concat of 1, 3, 3, 1, 2, 7");
