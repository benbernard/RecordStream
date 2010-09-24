package Recs::Aggregator::InjectInto::Field;

use strict;
use lib;

use base qw(Recs::Aggregator::InjectInto);

sub new
{
   my $class = shift;
   my $field = shift;

   my $this = {
      'field' => $field,
   };

   bless $this, $class;

   return $this;
}

sub initial
{
   return undef;
}

sub combine
{
   my $this   = shift;
   my $cookie = shift;
   my $record = shift;

   my $value = ${$record->guess_key_from_spec($this->get_field())};

   if ( defined $value ) {
      return $this->combine_field($cookie, $value);
   }
   else {
      return $cookie;
   }
}

sub get_field 
{
    my $this = shift;
    return $this->{'field'};
}

sub squish
{
   my ($this, $cookie) = @_;

   return $cookie;
}

sub argct
{
   return 1;
}


1;
