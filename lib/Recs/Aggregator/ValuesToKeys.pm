package Recs::Aggregator::ValuesToKeys;

use strict;
use lib;

use Recs::Aggregator;
use base qw(Recs::Aggregator::MapReduce::FieldSet);

sub map_fields {
  my ($this, $key, $value) = @_;
  return { $key => $value };
}

sub reduce
{
   my ($this, $cookie1, $cookie2) = @_;

   foreach my $key (keys %$cookie2 ) {
     my $value = $cookie2->{$key};
     $cookie1->{$key} = $value;
   }

   return $cookie1;
}

sub long_usage
{
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

sub short_usage
{
   return "use one key-value as a key for a different value in the record";
}

sub argct
{
   return 2;
}

Recs::Aggregator::register_aggregator('valuestokeys', __PACKAGE__);
Recs::Aggregator::register_aggregator('vk', __PACKAGE__);

1;
