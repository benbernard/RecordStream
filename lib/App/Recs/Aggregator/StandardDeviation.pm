package Recs::Aggregator::StandardDeviation;

use strict;
use lib;

use Recs::Aggregator::Ord2Univariate;
use Recs::Aggregator;

use base 'Recs::Aggregator::Ord2Univariate';

sub new
{
   my ($class, @args) = @_;
   return $class->SUPER::new(@args);
}

sub squish
{
   my ($this, $cookie) = @_;

   my ($sum1, $sumx, $sumx2) = @$cookie;

   return sqrt(($sumx2 / $sum1) - ($sumx / $sum1) ** 2);
}

sub long_usage
{
   while(my $line = <DATA>)
   {
      print $line;
   }
   exit 1;
}

sub short_usage
{
   return "find standard deviation of provided field";
}

Recs::Aggregator::register_aggregator('stddev', __PACKAGE__);

1;

__DATA__
Usage: stddev,<field1>
   Standard deviation of specified fields.

This is computed as StdDev(X) = sqrt(E[(X - E[X])^2]).  Standard deviation is
an indication of deviation from average value.
