package App::RecordStream::Aggregator::First;

our $VERSION = "3.4";

use strict;
use lib;

use App::RecordStream::Aggregator::InjectInto::Field;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto::Field);

#sub new -- passed through

#sub new_from_valuation -- passed through

sub combine_field
{
   my $this   = shift;
   my $cookie = shift;
   my $value  = shift;

   return defined($cookie) ? $cookie : $value;
}

sub short_usage
{
   return "first value for a field";
}

sub long_usage
{
   print "Usage: first,<field>\n";
   print "   First value of specified field.\n";
   exit 1;
}

App::RecordStream::Aggregator::register_aggregator('first', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'first', 'VALUATION');

1;
