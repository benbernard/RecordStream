package App::RecordStream::Aggregator::Sum;

our $VERSION = "3.4";

use strict;
use lib;

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
   print "Usage: sum,<field>\n";
   print "   Sums specified field.\n";
   exit 1;
}

sub short_usage
{
   return "sums provided field";
}

App::RecordStream::Aggregator::register_aggregator('sum', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'sum', 'VALUATION');

1;
