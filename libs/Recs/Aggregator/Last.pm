package Recs::Aggregator::Last;

use strict;
use lib;

use Recs::Aggregator::InjectInto::Field;
use base qw(Recs::Aggregator::InjectInto::Field);

sub new
{
   my $class = shift;
   my @args  = @_;

   return $class->SUPER::new(@args);
}

sub combine_field
{
   my $this   = shift;
   my $cookie = shift;
   my $value  = shift;

   return $value;
}

sub short_usage
{
   return "last value for a field";
}

sub long_usage
{
   print "Usage: last,<field>\n";
   print "   Last value of specified field.\n";
   exit 1;
}

Recs::Aggregator::register_aggregator('last', __PACKAGE__);

1;
