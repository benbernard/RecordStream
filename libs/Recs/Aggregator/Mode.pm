package Recs::Aggregator::Mode;

use strict;
use lib;

use Recs::Aggregator::InjectInto::Field;
use base qw(Recs::Aggregator::InjectInto::Field);

sub new
{
   my $class = shift;
   return $class->SUPER::new(@_);
}

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

Recs::Aggregator::register_aggregator('mode', __PACKAGE__);

1;
