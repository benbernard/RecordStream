use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::Variance"); }
BEGIN { use_ok("App::RecordStream::Record"); }

my $aggr = App::RecordStream::Aggregator::Variance->new("x");

my $cookie = $aggr->initial();

foreach my $n (1, 3, 7)
{
   $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
}

my $value = $aggr->squish($cookie);

is($value, 56 / 9, "variance for 1, 3, 7");
