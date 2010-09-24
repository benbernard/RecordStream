package Recs::Aggregator::Percentile;

use strict;
use lib;

use Recs::Aggregator::InjectInto::Field;
use base qw(Recs::Aggregator::InjectInto::Field);

sub new
{
   my $class      = shift;
   my $percentile = shift;
   my $field      = shift;

   my $this = $class->SUPER::new($field);
   $this->{'percentile'} = $percentile;

   return $this;
}

sub initial {
   return [];
}

sub combine_field
{
   my $this   = shift;
   my $cookie = shift;
   my $value  = shift;

   push @$cookie, $value;
   return $cookie;
}

sub squish
{
   my $this   = shift;
   my $cookie = shift;

   my $percentile = $this->{'percentile'};

   my @sorted = sort { $a <=> $b } @$cookie;

   my $index = int( (scalar @sorted) * ($percentile / 100));

   if ( $index == scalar @sorted )
   {
      $index--;
   }

   return $sorted[$index];
}

sub short_usage
{
   return "value of pXX for field";
}

sub long_usage
{
   print <<USAGE;
Usage: per,<percentile>,<field>
   Finds the field value which <percentile> percent of values are less than.

   This is computed by creating an array of all values, sorting, and indexing into it at the
   floor((percentile / 100) * length) point
USAGE

   exit 1
}

sub argct
{
   return 2;
}

Recs::Aggregator::register_aggregator('percentile', __PACKAGE__);
Recs::Aggregator::register_aggregator('perc', __PACKAGE__);

1;
