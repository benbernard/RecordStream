package Recs::Aggregator::InjectInto;

use Recs::Aggregator;

use base qw(Recs::Aggregator::Aggregation);

use strict;
use lib;

sub new
{
   my $class = shift;

   my $this = { };
   bless $this, $class;

   return $this;
}

sub initial
{
   return undef;
}

sub combine
{
   die "InjectInto subclass did not implement combine.\n";
}

sub squish
{
   my ($this, $cookie) = @_;

   return $cookie;
}

1;
