package App::RecordStream::Aggregator::Concatenate;

our $VERSION = "4.0.1";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce::Field;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::MapReduce::Field';

sub new
{
  my $class = shift;
  my $delim = shift;
  my $field = shift;

  my $this = $class->SUPER::new($field);
  $this->{'delim'} = $delim;

  return $this;
}

sub new_from_valuation
{
  my $class     = shift;
  my $delim     = shift;
  my $valuation = shift;

  my $this = $class->SUPER::new_from_valuation($valuation);
  $this->{'delim'} = $delim;

  return $this;
}

sub map_field
{
  my ($this, $value) = @_;

  return [$value];
}

sub reduce
{
  my ($this, $cookie, $cookie2) = @_;

  return [@$cookie, @$cookie2];
}

sub squish
{
  my ($this, $cookie) = @_;

  return join($this->{'delim'}, @$cookie);
}

sub long_usage
{
  return <<EOF;
Usage: concat,<delimiter>,<field>
   Concatenate values from specified field.
EOF
}

sub short_usage
{
  return "concatenate values from provided field";
}

sub argct
{
  return 2;
}

App::RecordStream::Aggregator->register_implementation('concatenate', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('concat', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'concatenate', 'SCALAR', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'concat', 'SCALAR', 'VALUATION');

1;
