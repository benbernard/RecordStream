package App::RecordStream::Aggregator::Covariance;

our $VERSION = "3.4";

use strict;
use lib;

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

   return ($sumxy / $sum1) - ($sumx / $sum1) * ($sumy / $sum1);
}

sub long_usage
{
   while(my $line = <DATA>)
   {
      print $line;
   }
   exit 1;
}

sub short_usage
{
   return "find covariance of provided fields";
}

App::RecordStream::Aggregator::register_aggregator('cov', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('covar', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('covariance', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'cov', 'VALUATION', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'covar', 'VALUATION', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'covariance', 'VALUATION', 'VALUATION');

1;

__DATA__
Usage: cov,<field1>,<field2>
   Covariance of specified fields.

This is computed as Cov(X, Y) = E[(X - E[X]) * (Y - E[Y])].
