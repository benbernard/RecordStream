use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::Aggregator::Mode"); }

ok(my $aggr = App::RecordStream::Aggregator::Mode->new("x"), "Initialize");

my $cookie = $aggr->initial();

foreach my $n (1, 2, 3, 4, 5, 5, 5, 6, 6)
{
   $cookie = $aggr->combine($cookie, App::RecordStream::Record->new("x" => $n));
}

my $value = $aggr->squish($cookie);

is($value, 5, "mode of 1, 2, 3, 4, 5, 5, 5, 6, 6");
