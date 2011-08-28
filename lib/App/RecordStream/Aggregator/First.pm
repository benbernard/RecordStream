package App::RecordStream::Aggregator::First;

use strict;
use lib;

use App::RecordStream::Aggregator::InjectInto::Field;
use base qw(App::RecordStream::Aggregator::InjectInto::Field);

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

   return defined($cookie) ? $cookie : $value;
}

sub short_usage
{
   return "first value for a field";
}

sub long_usage
{
   print "Usage: first,<field>\n";
   print "   First value of specified field.\n";
   exit 1;
}

App::RecordStream::Aggregator::register_aggregator('first', __PACKAGE__);

1;
