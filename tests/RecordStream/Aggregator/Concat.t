use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::Concatenate"); }
BEGIN { use_ok("App::RecordStream::Record"); }

my $aggr = App::RecordStream::Aggregator::Concatenate->new(',',"x");

my $cookie = $aggr->initial();

foreach my $n (1, 3, 3, 7)
{
   $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
}

my $value = $aggr->squish($cookie);

is($value, '1,3,3,7', "concat of 1, 3, 3, 7");
