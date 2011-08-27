package Recs::Aggregator::RecordForMinimum;

use strict;
use lib;

use base 'Recs::Aggregator::MapReduce';

sub new
{
   my $class = shift;
   my ($field) = @_;

   my $this =
   {
      'field' => $field,
   };
   bless $this, $class;

   return $this;
}

sub map
{
   my ($this, $record) = @_;

   my $value = ${$record->guess_key_from_spec($this->{'field'})};

   return [$value, $record];
}

sub reduce
{
   my ($this, $cookie1, $cookie2) = @_;

   my ($v1, $r1) = @$cookie1;
   my ($v2, $r2) = @$cookie2;

   if($v1 > $v2)
   {
      return $cookie1;
   }

   return $cookie2;
}

sub squish
{
   my ($this, $cookie) = @_;

   my ($v, $r) = @$cookie;

   return $r;
}

sub argct
{
   return 1;
}

sub short_usage
{
   return "returns the record corresponding to the minimum value for a field";
}

sub long_usage
{
   print "Usage: recformin,<field>\n";
   print "   The record corresponding to the minimum value of specified field.\n";
   exit 1;
}

sub returns_record
{
   return 1;
}

Recs::Aggregator::register_aggregator('recformin', __PACKAGE__);
Recs::Aggregator::register_aggregator('recforminimum', __PACKAGE__);
Recs::Aggregator::register_aggregator('recordformin', __PACKAGE__);
Recs::Aggregator::register_aggregator('recordforminimum', __PACKAGE__);

1;
