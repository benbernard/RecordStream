package App::RecordStream::Aggregator::UniqArray;

our $VERSION = "4.0.13";

use strict;
use warnings;

use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base qw(App::RecordStream::Aggregator::Aggregation);

sub new {
  my $class = shift;
  my $field = shift;

  return new_from_valuation($class, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation {
  my $class = shift;
  my $valuation = shift;

  my $this =
  {
    'valuation' => $valuation,
  };

  bless $this, $class;

  return $this;
}

sub squish {
  my ($this, $cookie) = @_;

  return [ sort keys %$cookie ];
}

sub long_usage {
  return <<EOF;
Usage: uarray,<field>
   Collect unique values from specified field into an array.
EOF
}

sub short_usage {
  return "collect unique values from provided field into an array";
}

sub argct {
  return 1;
}

sub initial {
  return {};
}

sub combine {
  my ($this, $cookie, $record) = @_;

  my $value = $this->{'valuation'}->evaluate_record($record);

  $cookie->{$value} = 1;

  return $cookie;
}

App::RecordStream::Aggregator->register_implementation('uarray', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'uarray', 'VALUATION');

1;
