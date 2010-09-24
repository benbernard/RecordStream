package Recs::Aggregator::LastRecord;

use strict;
use lib;

use base qw(Recs::Aggregator::InjectInto);

sub new
{
   my $class = shift;
   my @args  = @_;

   return $class->SUPER::new(@args);
}

sub combine
{
   my $this   = shift;
   my $cookie = shift;
   my $record  = shift;

   return $record;
}

sub short_usage
{
   return "last record seen";
}

sub long_usage
{
   print "Usage: last_record\n";
   print "   Last record seen.\n";
   exit 1;
}

sub returns_record
{
   return 1;
}

sub argct 
{
   return 0;
}

Recs::Aggregator::register_aggregator('lastrecord', __PACKAGE__);
Recs::Aggregator::register_aggregator('lastrec', __PACKAGE__);

1;
