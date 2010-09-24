package Recs::Aggregator::Count;

use strict;
use lib;

use Recs::Aggregator::MapReduce;
use Recs::Aggregator;

use base 'Recs::Aggregator::MapReduce';

sub new
{
   my ($class, @args) = @_;
   return $class->SUPER::new(@args);
}

sub map
{
   return 1;
}

sub reduce
{
   my ($this, $cookie, $cookie2) = @_;

   return $cookie + $cookie2;
}

sub argct
{
   return 0;
}

sub long_usage
{
   print "Usage: count\n";
   print "   Counts number of (non-unique) records.\n";
   exit 1;
}

sub short_usage
{
   return "counts (non-unique) records";
}

Recs::Aggregator::register_aggregator('count', __PACKAGE__);
Recs::Aggregator::register_aggregator('ct', __PACKAGE__);

1;
