package Recs::Aggregator::CountBy;

use strict;
use warnings;

use base qw(Recs::Aggregator::InjectInto::Field);

sub new
{
   my $class = shift;
   my $field = shift;

   my $this = $class->SUPER::new($field);
   return $this;
}

sub initial
{
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

sub squish
{
   my $this   = shift;
   my $cookie = shift;

   return $cookie;
}

sub short_usage
{
   return "counts by unique value for a field";
}

sub long_usage
{
   print <<USAGE;
Usage: cb,<field>

  Returns a list of uniq values associated with their counts.

  Unlike most other aggregators, the value of the field returned will actually
  be a hash, with keys of uniq fields, and values of the counts.
USAGE

   exit 1;
}

sub argct
{
   return 1;
}

Recs::Aggregator::register_aggregator('countby', __PACKAGE__);
Recs::Aggregator::register_aggregator('cb', __PACKAGE__);

1;
