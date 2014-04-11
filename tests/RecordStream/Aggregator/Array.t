use strict;
use warnings;

use Test::More 'no_plan';

BEGIN {
    use_ok("App::RecordStream::Aggregator::Array");
    use_ok("App::RecordStream::Aggregator::UniqArray");
    use_ok("App::RecordStream::Record");
    use_ok("App::RecordStream::Test::Aggregator::ArrayHelper");
}

my @values = (1, 3, 3, 7);

array_agg_ok( "Array",     \@values, \@values,  "array of 1, 3, 3, 7" );
array_agg_ok( "UniqArray", \@values, [1, 3, 7], "array of 1, 3, 7" );
