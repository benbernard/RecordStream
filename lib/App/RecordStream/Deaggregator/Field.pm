package App::RecordStream::Deaggregator::Field;

use strict;
use warnings;

use App::RecordStream::Deaggregator::Base;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base 'App::RecordStream::Deaggregator::Base';

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

sub deaggregate
{
    my $this = shift;
    my $record = shift;

    my $valuation = $this->{'valuation'};

    my $value = $valuation->evaluate_record($record);

    return $this->deaggregate_field($value);
}

1;
