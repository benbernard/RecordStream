package App::RecordStream::Aggregator::InjectInto::Field;

our $VERSION = "3.4";

use strict;
use lib;

use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;
use App::RecordStream::Aggregator::InjectInto;

use base qw(App::RecordStream::Aggregator::InjectInto);

sub new
{
   my $class = shift;
   my $field = shift;

   return new_from_valuation($class, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation
{
   my $class = shift;
   my $valuation = shift;

   my $this =
   {
      'valuation' => $valuation,
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

   my $value = $this->get_valuation()->evaluate_record($record);

   if ( defined $value )
   {
      return $this->combine_field($cookie, $value);
   }
   else
   {
      return $cookie;
   }
}

sub get_valuation
{
    my $this = shift;
    return $this->{'valuation'};
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
