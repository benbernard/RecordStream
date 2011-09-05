package App::RecordStream::Aggregator::Mode;

our $VERSION = "3.4";

use strict;
use lib;

use App::RecordStream::Aggregator::InjectInto::Field;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto::Field);

#sub new -- passed through

#sub new_from_valuation -- passed through

sub initial {
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

sub squish {
   my $this   = shift;
   my $cookie = shift;

   my @keys      = keys %$cookie;
   my $max_key   = shift @keys;
   my $max_value = $cookie->{$max_key};

   foreach my $key ( @keys ) {
      my $value = $cookie->{$key};
      if ( $max_value < $value ) {
         $max_key   = $key;
         $max_value = $value;
      }
   }

   return $max_key;
}

sub short_usage
{
   return "most common value for a field";
}

sub long_usage
{
   print <<USAGE;
Usage: mode,<field>
   Finds the most common value for a field and returns it.
   Will load all values into memory.
USAGE

   exit 1
}

App::RecordStream::Aggregator::register_aggregator('mode', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'mode', 'VALUATION');

1;
