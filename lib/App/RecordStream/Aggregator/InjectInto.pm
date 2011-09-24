package App::RecordStream::Aggregator::InjectInto;

our $VERSION = "3.4";

use App::RecordStream::Aggregator;

use base qw(App::RecordStream::Aggregator::Aggregation);

use strict;
use warnings;

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
