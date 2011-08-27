use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("Recs::Aggregator::Count"); }
BEGIN { use_ok("Recs::Record"); }

my $aggr = Recs::Aggregator::Count->new();

my $cookie = $aggr->initial();

my $rec = Recs::Record->new();

$cookie = $aggr->combine($cookie, $rec);
$cookie = $aggr->combine($cookie, $rec);
$cookie = $aggr->combine($cookie, $rec);

my $value = $aggr->squish($cookie);

is($value, 3, "count of 3");
