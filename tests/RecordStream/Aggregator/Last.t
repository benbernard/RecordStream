use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;
use App::RecordStream::Record;

BEGIN { use_ok("App::RecordStream::Aggregator::Last"); }
BEGIN { use_ok("App::RecordStream::Test::LastHelper"); }

ok(my $aggr = App::RecordStream::Aggregator::Last->new("x"), "Initialize");

App::RecordStream::Test::LastHelper::test_aggregator($aggr, "x");
