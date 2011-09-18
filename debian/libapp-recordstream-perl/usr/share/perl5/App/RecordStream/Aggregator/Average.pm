package App::RecordStream::Aggregator::Average;

our $VERSION = "3.4";

use strict;
use lib;

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

   return $sumx / $sum1;
}

sub long_usage
{
   print "Usage: avg,<field>\n";
   print "   Average of specified field.\n";
   exit 1;
}

sub short_usage
{
   return "averages provided field";
}

App::RecordStream::Aggregator::register_aggregator('average', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('avg', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'average', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'avg', 'VALUATION');

1;
