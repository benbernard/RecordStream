use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator"); }
BEGIN { use_ok("App::RecordStream::Record"); }

App::RecordStream::Aggregator::load_aggregators();
my $aggrs = App::RecordStream::Aggregator::make_aggregators("count", "sum,x", "sumy=sum,y", "biz/zap=count", "uuu/liz=firstrec");

my $cookies = App::RecordStream::Aggregator::map_initial($aggrs);

my $rec1 = App::RecordStream::Record->new("x" => "1", "y" => "2");
$cookies = App::RecordStream::Aggregator::map_combine($aggrs, $cookies, $rec1);

my $rec2 = App::RecordStream::Record->new("x" => "3", "y" => "4");
$cookies = App::RecordStream::Aggregator::map_combine($aggrs, $cookies, $rec2);

my $values = App::RecordStream::Aggregator::map_squish($aggrs, $cookies);

is_deeply($values, {"sum_x" => 4, "sumy" => 6, "count" => 2, biz => { zap => 2}, uuu => { liz_x => 1, liz_y => 2}});
