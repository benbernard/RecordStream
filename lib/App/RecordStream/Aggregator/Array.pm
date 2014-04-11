package App::RecordStream::Aggregator::Array;

our $VERSION = "4.0.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce::Field;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::MapReduce::Field';

sub map_field {
  my ($this, $value) = @_;

  return [$value];
}

sub reduce {
  my ($this, $cookie, $cookie2) = @_;

  return [@$cookie, @$cookie2];
}

sub long_usage {
  return <<EOF;
Usage: array,<field>
   Collect values from specified field into an array.
EOF
}

sub short_usage {
  return "collect values from provided field into an array";
}

sub argct {
  return 1;
}

App::RecordStream::Aggregator->register_implementation('array', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'array', 'VALUATION');

1;
