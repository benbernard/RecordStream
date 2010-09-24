use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("Recs::Aggregator"); }
BEGIN { use_ok("Recs::Record"); }

Recs::Aggregator::load_aggregators();
my $aggrs = Recs::Aggregator::make_aggregators("count", "sum,x", "sumy=sum,y", "biz/zap=count", "uuu/liz=firstrec");

my $cookies = Recs::Aggregator::map_initial($aggrs);

my $rec1 = Recs::Record->new("x" => "1", "y" => "2");
$cookies = Recs::Aggregator::map_combine($aggrs, $cookies, $rec1);

my $rec2 = Recs::Record->new("x" => "3", "y" => "4");
$cookies = Recs::Aggregator::map_combine($aggrs, $cookies, $rec2);

my $values = Recs::Aggregator::map_squish($aggrs, $cookies);

is_deeply($values, {"sum_x" => 4, "sumy" => 6, "count" => 2, biz => { zap => 2}, uuu => { liz_x => 1, liz_y => 2}});
