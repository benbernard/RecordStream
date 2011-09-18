package App::RecordStream::Aggregator::MapReduce::Field;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base 'App::RecordStream::Aggregator::MapReduce';

sub new
{
   my $class = shift;
   my $field = shift;

   return new_from_valuation($class, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation
{
   my $class = shift;
   my $valuation = shift;

   my $this =
   {
      'valuation' => $valuation,
   };
   bless $this, $class;

   return $this;
}

sub map
{
   my ($this, $record) = @_;

   if(!defined($this->{'valuation'}))
   {
       # oopsie, consider missing/undef fields not to count and return the empty cookie
       return undef;
   }
   return $this->map_field($this->{'valuation'}->evaluate_record($record));
}

sub map_field
{
   my ($this, $value) = @_;

   return $value;
}

sub argct
{
   return 1;
}

1;
