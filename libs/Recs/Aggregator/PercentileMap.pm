package Recs::Aggregator::PercentileMap;

use strict;
use lib;

use Recs::Aggregator::InjectInto::Field;
use base qw(Recs::Aggregator::InjectInto::Field);

sub new
{
   my $class       = shift;
   my $percentiles = shift;
   my $field       = shift;

   my $this = $class->SUPER::new($field);
   # be careful, split(' ', ...) is extreme magic split, not split on one space
   $this->{'percentiles'} = [split(' ', $percentiles)];

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

   my @sorted = sort { $a <=> $b } @$cookie;

   my %ret;

   for my $percentile (@{$this->{'percentiles'}})
   {
       my $index = int((scalar @sorted) * ($percentile / 100));

       if($index == scalar(@sorted))
       {
           $index--;
       }

       $ret{$percentile} = $sorted[$index];
   }

   return \%ret;
}

sub short_usage
{
   return "map of percentile values for field";
}

sub long_usage
{
   print <<USAGE;
Usage: percmap,<percentiles>,<field>
   Finds the field values which <percentiles> percent of values are less than.

   This is computed by creating an array of all values, sorting, and indexing
   into it at the floor((percentile / 100) * length) point

   <percentiles> will be perl split to determine percentiles to compute.

   Output is a hash whose keys are percentiles and whose values are
   corresponding field values.
USAGE

   exit 1
}

sub argct
{
   return 2;
}

Recs::Aggregator::register_aggregator('percentilemap', __PACKAGE__);
Recs::Aggregator::register_aggregator('percmap', __PACKAGE__);

1;
