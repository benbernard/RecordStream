package App::RecordStream::Aggregator::CountBy;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::InjectInto::Field;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto::Field);

#sub new -- passed through

#sub new_from_valuation -- passed through

sub initial
{
   return {};
}

sub combine_field
{
   my $this   = shift;
   my $cookie = shift;
   my $value  = shift;

   $cookie->{$value}++;
   return $cookie;
}

sub squish
{
   my $this   = shift;
   my $cookie = shift;

   return $cookie;
}

sub short_usage
{
   return "counts by unique value for a field";
}

sub long_usage
{
   print <<USAGE;
Usage: cb,<field>

  Returns a list of uniq values associated with their counts.

  Unlike most other aggregators, the value of the field returned will actually
  be a hash, with keys of uniq fields, and values of the counts.
USAGE

   exit 1;
}

sub argct
{
   return 1;
}

App::RecordStream::Aggregator::register_aggregator('countby', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('cb', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'countby', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'cb', 'VALUATION');

1;
