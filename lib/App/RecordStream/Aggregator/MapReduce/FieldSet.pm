package App::RecordStream::Aggregator::MapReduce::FieldSet;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base 'App::RecordStream::Aggregator::MapReduce';

sub new
{
   my $class = shift;
   my @fields = @_;

   return new_from_valuation($class, map { App::RecordStream::DomainLanguage::Valuation::KeySpec->new($_) } @fields);
}

sub new_from_valuation
{
   my $class = shift;
   my @valuations = @_;

   my $this =
   {
      'valuations' => \@valuations,
   };
   bless $this, $class;

   return $this;
}

sub map
{
   my ($this, $record) = @_;

   return $this->map_fields(map { $_->evaluate_record($record) } @{$this->{'valuations'}});
}

sub map_fields
{
   die "FieldSet subclass does not implement map_fields\n";
}

1;
