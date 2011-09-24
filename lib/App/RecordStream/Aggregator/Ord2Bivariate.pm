package App::RecordStream::Aggregator::Ord2Bivariate;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce::FieldSet;
use App::RecordStream::Aggregator;

use base 'App::RecordStream::Aggregator::MapReduce::FieldSet';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub map_fields
{
   my ($this, $x, $y) = @_;

   return [1,
           $x,
           $y,
           $x * $y,
           $x * $x,
           $y * $y];
}

sub reduce
{
   my ($this, $cookie, $cookie2) = @_;

   my ($sum1_1, $sumx_1, $sumy_1, $sumxy_1, $sumx2_1, $sumy2_1) = @$cookie;
   my ($sum1_2, $sumx_2, $sumy_2, $sumxy_2, $sumx2_2, $sumy2_2) = @$cookie2;

   return [$sum1_1  + $sum1_2,
           $sumx_1  + $sumx_2,
           $sumy_1  + $sumy_2,
           $sumxy_1 + $sumxy_2,
           $sumx2_1 + $sumx2_2,
           $sumy2_1 + $sumy2_2];
}

sub squish
{
   die "Ord2Bivariate subclass doesn't implement squish\n";
}

sub argct
{
   return 2;
}

1;
