package App::RecordStream::Aggregator::Ord2Univariate;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce::Field;
use App::RecordStream::Aggregator;

use base 'App::RecordStream::Aggregator::MapReduce::Field';

#sub new -- passed through

#sub new_from_valuation -- passed through

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
