package Recs::Aggregator::UniqConcatenate;

use strict;
use lib;

use Recs::Aggregator;
use base qw(Recs::Aggregator::Aggregation);

sub new
{
   my ($class, $delim, $field) = @_;

   my $this =
   {
      'field' => $field,
      'delim' => $delim,
   };
   bless $this, $class;

   return $this;
}

sub squish
{
   my ($this, $cookie) = @_;

   return join($this->{'delim'}, sort(keys(%$cookie)));
}

sub long_usage
{
   print "Usage: uconcat,<delimiter>,<field>\n";
   print "   Concatenate unique values from specified field.\n";
   exit 1;
}

sub short_usage
{
   return "concatenate unique values from provided field";
}

sub argct
{
   return 2;
}

sub initial
{
   return {};
}

sub combine
{
   my ($this, $cookie, $record) = @_;

   my $value = ${$record->guess_key_from_spec($this->{'field'})};
   $cookie->{$value} = 1;

   return $cookie;
}

Recs::Aggregator::register_aggregator('uconcatenate', __PACKAGE__);
Recs::Aggregator::register_aggregator('uconcat', __PACKAGE__);

1;
