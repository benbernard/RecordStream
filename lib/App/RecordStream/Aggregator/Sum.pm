package App::RecordStream::Aggregator::Sum;

our $VERSION = "4.0.21";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce::Field;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::MapReduce::Field';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub reduce
{
  my ($this, $cookie, $cookie2) = @_;

  return $cookie + $cookie2;
}

sub long_usage
{
  return <<EOF;
Usage: sum,<field>
   Sums specified field.
EOF
}

sub short_usage
{
  return "sums provided field";
}

App::RecordStream::Aggregator->register_implementation('sum', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'sum', 'VALUATION');

1;
