use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::Aggregator::DistinctCount"); }
BEGIN { use_ok("App::RecordStream::Test::DistinctCountHelper"); }

ok(my $aggr = App::RecordStream::Aggregator::DistinctCount->new("x"), "Initialize");

App::RecordStream::Test::DistinctCountHelper::test_aggregator($aggr, "x");
