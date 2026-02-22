use strict;
use warnings;

use Test::More 'no_plan';
use Data::Dumper;

BEGIN { use_ok("App::RecordStream::Aggregator::Sum"); }
BEGIN { use_ok("App::RecordStream::Record"); }

my $aggrx = App::RecordStream::Aggregator::Sum->new("x");
my $aggry = App::RecordStream::Aggregator::Sum->new("y");

my $cookiex = $aggrx->initial();
my $cookiey = $aggry->initial();

my $rec1 = App::RecordStream::Record->new("x" => "1", "y" => "2");

$cookiex = $aggrx->combine($cookiex, $rec1);
$cookiey = $aggry->combine($cookiey, $rec1);

my $rec2 = App::RecordStream::Record->new("x" => "3", "y" => "4");

$cookiex = $aggrx->combine($cookiex, $rec2);
$cookiey = $aggry->combine($cookiey, $rec2);

my $valuex = $aggrx->squish($cookiex);
my $valuey = $aggry->squish($cookiey);

is($valuex, 4, "x sum of 1 and 3");
is($valuey, 6, "y sum of 2 and 4");
