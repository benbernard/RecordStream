use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::UniqConcatenate"); }
BEGIN { use_ok("App::RecordStream::Record"); }
BEGIN { use_ok("App::RecordStream::Test::UniqConcatHelper"); }

ok(my $aggr = App::RecordStream::Aggregator::UniqConcatenate->new(',', 'x'), "Initialize");

App::RecordStream::Test::UniqConcatHelper::test_aggregator($aggr, ',', 'x');
