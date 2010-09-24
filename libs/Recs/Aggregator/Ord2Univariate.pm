package Recs::Aggregator::Ord2Univariate;

use strict;
use lib;

use Recs::Aggregator::MapReduce::Field;
use Recs::Aggregator;

use base 'Recs::Aggregator::MapReduce::Field';

sub new
{
   my ($class, @args) = @_;
   return $class->SUPER::new(@args);
}

sub map_field
{
   my ($this, $x) = @_;

   return [1,
           $x,
           $x * $x];
}

sub reduce
{
   my ($this, $cookie, $cookie2) = @_;

   my ($sum1_1, $sumx_1, $sumx2_1) = @$cookie;
   my ($sum1_2, $sumx_2, $sumx2_2) = @$cookie2;

   return [$sum1_1  + $sum1_2,
           $sumx_1  + $sumx_2,
           $sumx2_1 + $sumx2_2];
}

sub squish
{
   die "Ord2Univariate subclass doesn't implement squish\n";
}

1;
