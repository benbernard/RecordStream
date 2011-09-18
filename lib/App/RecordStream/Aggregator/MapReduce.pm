package App::RecordStream::Aggregator::MapReduce;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Aggregator::Aggregation);

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
   my ($this, $cookie, $record) = @_;

   my $cookie2 = $this->map($record);

   # treat undef on either side as empty and return the other
   if(!defined($cookie))
   {
       return $cookie2;
   }
   if(!defined($cookie2))
   {
       return $cookie;
   }

   # if they're both non-undef then combine them
   return $this->reduce($cookie, $cookie2);
}

sub squish
{
   my ($this, $cookie) = @_;

   return $cookie;
}

sub map
{
   die "MapReduce subclass did not implement map.\n";
}

sub reduce
{
   die "MapReduce subclass did not implement reduce.\n";
}

1;
