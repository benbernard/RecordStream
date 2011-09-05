package App::RecordStream::Aggregator::Maximum;

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

   return $value unless ( defined $cookie );

   if ( $cookie < $value )
   {
      return $value;
   }

   return $cookie;
}

sub short_usage
{
   return "maximum value for a field";
}

sub long_usage
{
   print "Usage: max,<field>\n";
   print "   Maximum value of specified field.\n";
   exit 1;
}

App::RecordStream::Aggregator::register_aggregator('maximum', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('max', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'maximum', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'max', 'VALUATION');

1;
