package Recs::Aggregator::Maximum;

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

Recs::Aggregator::register_aggregator('maximum', __PACKAGE__);
Recs::Aggregator::register_aggregator('max', __PACKAGE__);

1;
