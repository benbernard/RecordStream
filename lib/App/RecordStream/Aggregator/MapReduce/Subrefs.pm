package App::RecordStream::Aggregator::MapReduce::Subrefs;

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce;

use base 'App::RecordStream::Aggregator::MapReduce';

sub new
{
   my $class = shift;
   my $map = shift;
   my $reduce = shift;
   my $squish = shift;

   my $this =
   {
      'map' => $map,
      'reduce' => $reduce,
      'squish' => $squish,
   };

   bless $this, $class;

   return $this;
}

sub map
{
   my $this = shift;

   return $this->{'map'}->(@_);
}

sub reduce
{
   my $this = shift;

   return $this->{'reduce'}->(@_);
}

sub squish
{
   my $this = shift;

   return $this->{'squish'}->(@_);
}

1;
