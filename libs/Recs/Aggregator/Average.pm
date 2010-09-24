package Recs::Aggregator::Average;

use strict;
use lib;

use Recs::Aggregator::Ord2Univariate;
use Recs::Aggregator;

use base 'Recs::Aggregator::Ord2Univariate';

sub new
{
   my ($class, @args) = @_;
   return $class->SUPER::new(@args);
}

sub squish
{
   my ($this, $cookie) = @_;

   my ($sum1, $sumx, $sumx2) = @$cookie;

   return $sumx / $sum1;
}

sub long_usage
{
   print "Usage: avg,<field>\n";
   print "   Average of specified field.\n";
   exit 1;
}

sub short_usage
{
   return "averages provided field";
}

Recs::Aggregator::register_aggregator('average', __PACKAGE__);
Recs::Aggregator::register_aggregator('avg', __PACKAGE__);

1;
