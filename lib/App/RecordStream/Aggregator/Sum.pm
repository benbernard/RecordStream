package App::RecordStream::Aggregator::Sum;

use strict;
use lib;

use App::RecordStream::Aggregator::MapReduce::Field;
use App::RecordStream::Aggregator;

use base 'App::RecordStream::Aggregator::MapReduce::Field';

sub new
{
   my ($class, @args) = @_;
   return $class->SUPER::new(@args);
}

sub reduce
{
   my ($this, $cookie, $cookie2) = @_;

   return $cookie + $cookie2;
}

sub long_usage
{
   print "Usage: sum,<field>\n";
   print "   Sums specified field.\n";
   exit 1;
}

sub short_usage
{
   return "sums provided field";
}

App::RecordStream::Aggregator::register_aggregator('sum', __PACKAGE__);

1;
