package App::RecordStream::Aggregator::ValuesToKeys;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator;
use base qw(App::RecordStream::Aggregator::MapReduce::FieldSet);

#sub new -- passed through

#sub new_from_valuation -- passed through

sub map_fields {
   my ($this, $key, $value) = @_;
   return { $key => $value };
}

sub reduce {
   my ($this, $cookie1, $cookie2) = @_;

   foreach my $key (keys %$cookie2 ) {
      my $value = $cookie2->{$key};
      $cookie1->{$key} = $value;
   }

   return $cookie1;
}

sub long_usage {
   print <<USAGE;
Usage: valuestokeys,<keyfield>,<valuefield>
  Take the specified keyfield, use its value as the key for the value of value
  field..  For instance:
  { k: 'FOO', t: 2 }
  { k: 'BAR', t: 5 }

  becomes:
  { 'FOO': 2, 'BAR': 5 }

  with the aggregator 'vk,k,t'.  Repeated keyfield values will clobber earlier
  instances
USAGE
   exit 1;
}

sub short_usage {
   return "use one key-value as a key for a different value in the record";
}

sub argct {
   return 2;
}

App::RecordStream::Aggregator::register_aggregator('valuestokeys', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('vk', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'valuestokeys', 'VALUATION', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'vk', 'VALUATION', 'VALUATION');

1;
