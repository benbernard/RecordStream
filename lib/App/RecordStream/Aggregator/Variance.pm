package App::RecordStream::Aggregator::Variance;

our $VERSION = "4.0.15";

use strict;
use warnings;

use App::RecordStream::Aggregator::Ord2Univariate;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::Ord2Univariate';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub squish
{
  my ($this, $cookie) = @_;

  my ($sum1, $sumx, $sumx2) = @$cookie;

  return ($sumx2 / $sum1) - ($sumx / $sum1) ** 2;
}

sub long_usage
{
  return <<EOF;
Usage: var,<field1>
   Variance of specified fields.

   This is computed as Var(X) = E[(X - E[X])^2].  Variance is an indication of
   deviation from average value.
EOF
}

sub short_usage
{
  return "find variance of provided field";
}

App::RecordStream::Aggregator->register_implementation('var', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('variance', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'var', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'variance', 'VALUATION');

1;
