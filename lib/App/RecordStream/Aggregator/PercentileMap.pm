package App::RecordStream::Aggregator::PercentileMap;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::InjectInto::Field;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto::Field);

sub _make_percentiles
{
   my $percentiles = shift;

   if(ref($percentiles) eq "ARRAY")
   {
      return $percentiles;
   }

   # be careful, split(' ', ...) is extreme magic split, not split on one space
   return [split(' ', $percentiles)];
}

sub new
{
   my $class       = shift;
   my $percentiles = shift;
   my $field       = shift;

   my $this = $class->SUPER::new($field);
   $this->{'percentiles'} = _make_percentiles($percentiles);

   return $this;
}

sub new_from_valuation
{
   my $class       = shift;
   my $percentiles = shift;
   my $valuation   = shift;

   my $this = $class->SUPER::new_from_valuation($valuation);
   $this->{'percentiles'} = _make_percentiles($percentiles);

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

App::RecordStream::Aggregator::register_aggregator('percentilemap', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('percmap', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'percentilemap', 'SCALAR', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'percmap', 'SCALAR', 'VALUATION');

1;
