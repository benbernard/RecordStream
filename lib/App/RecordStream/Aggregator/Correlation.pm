package App::RecordStream::Aggregator::Correlation;

our $VERSION = "4.0.7";

use strict;
use warnings;

use App::RecordStream::Aggregator::Ord2Bivariate;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::Ord2Bivariate';

#sub new -- passed through

#sub new_from_valuation -- passed through

sub squish
{
  my ($this, $cookie) = @_;

  my ($sum1, $sumx, $sumy, $sumxy, $sumx2, $sumy2) = @$cookie;

  return ($sumxy * $sum1 - $sumx * $sumy) / sqrt(($sumx2 * $sum1 - $sumx ** 2) * ($sumy2 * $sum1 - $sumy ** 2));
}

sub long_usage
{
  return <<EOF
Usage: corr,<field1>,<field2>
   Correlation of specified fields.

This is Cov(X, Y) / sqrt(Var(X) * Var(Y)).  See help on aggregators cov and var
for how Cov(...) and Var(...) are computed.  Ultimately this value is in [-1,
1] where larger negative values indicate larger inverse correlation and larger
positive values indicate larger positive correlation.
EOF
}

sub short_usage
{
  return "find correlation of provided fields";
}

App::RecordStream::Aggregator->register_implementation('corr', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('correl', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('correlation', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'corr', 'VALUATION', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'correl', 'VALUATION', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'correlation', 'VALUATION', 'VALUATION');

1;
