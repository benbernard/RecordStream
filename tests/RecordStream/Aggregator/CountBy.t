use Test::More qw(no_plan);
use App::RecordStream::Test::OperationHelper;

use strict;
use warnings;

BEGIN { use_ok( 'App::RecordStream::Aggregator::CountBy' ) };

ok(my $agg = App::RecordStream::Aggregator::CountBy->new("x"), "Initialize");

my $cookie = $agg->initial();

foreach my $n (5, 2, 6, 4, 5, 1, 5, 6, 3) {
   $cookie = $agg->combine($cookie, App::RecordStream::Record->new({"x" => $n}));
}

my $value = $agg->squish($cookie);

my $expected = { 
   5 => 3, 
   2 => 1, 
   6 => 2, 
   4 => 1, 
   1 => 1,
   3 => 1,
};

is_deeply($value, $expected, "CountBy produced correct hash");
