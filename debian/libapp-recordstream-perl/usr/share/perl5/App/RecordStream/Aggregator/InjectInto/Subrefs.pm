package App::RecordStream::Aggregator::InjectInto::Subrefs;

use strict;
use lib;

use App::RecordStream::Aggregator::InjectInto;

use base qw(App::RecordStream::Aggregator::InjectInto);

sub new
{
   my $class = shift;
   my $initial = shift;
   my $combine = shift;
   my $squish = shift;

   my $this =
   {
      'initial' => $initial,
      'combine' => $combine,
      'squish' => $squish,
   };

   bless $this, $class;

   return $this;
}

sub initial
{
   my $this = shift;

   return $this->{'initial'}->();
}

sub combine
{
   my $this = shift;

   return $this->{'combine'}->(@_);
}

sub squish
{
   my $this = shift;

   return $this->{'squish'}->(@_);
}

1;
