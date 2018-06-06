package App::RecordStream::Aggregator::DistinctCount;

our $VERSION = "4.0.25";

use strict;
use warnings;

use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base qw(App::RecordStream::Aggregator::Aggregation);

sub new
{
  my $class = shift;
  my $field = shift;

  return new_from_valuation($class, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation
{
  my $class = shift;
  my ($valuation) = @_;

  my $this =
  {
    'valuation' => $valuation,
  };
  bless $this, $class;

  return $this;
}

sub squish
{
  my ($this, $cookie) = @_;

  return scalar(keys(%$cookie));
}

sub short_usage
{
  return "count unique values from provided field";
}

sub long_usage
{
  return <<EOF;
Usage: dct,<field>
   Finds the number of unique values for a field and returns it.  Will load all
   values into memory.
EOF
}

sub argct
{
  return 1;
}

sub initial
{
  return {};
}

sub combine
{
  my ($this, $cookie, $record) = @_;

  my $value = $this->{'valuation'}->evaluate_record($record);

  $cookie->{$value} = 1;

  return $cookie;
}

App::RecordStream::Aggregator->register_implementation('dcount', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('dct', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('distinctcount', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('distinctct', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'dcount', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'dct', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'distinctcount', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'distinctct', 'VALUATION');

1;
