package App::RecordStream::Aggregator::StandardDeviation;

our $VERSION = "3.4";

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

   return sqrt(($sumx2 / $sum1) - ($sumx / $sum1) ** 2);
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
   return "find standard deviation of provided field";
}

App::RecordStream::Aggregator::register_aggregator('stddev', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'stddev', 'VALUATION');

1;

__DATA__
Usage: stddev,<field1>
   Standard deviation of specified fields.

This is computed as StdDev(X) = sqrt(E[(X - E[X])^2]).  Standard deviation is
an indication of deviation from average value.
