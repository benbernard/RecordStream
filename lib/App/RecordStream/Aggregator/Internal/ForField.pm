package App::RecordStream::Aggregator::Internal::ForField;

use strict;
use warnings;

use App::RecordStream::Aggregator::Aggregation;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::Aggregation';

sub new
{
   my $class = shift;
   my $regex = shift;
   my $snippet = shift;

   my $this =
   {
       'REGEX' => $regex,
       'SNIPPET' => $snippet,
   };

   bless $this, $class;

   return $this;
}

sub initial
{
   return {};
}

sub combine
{
   my $this = shift;
   my $cookie = shift;
   my $record = shift;

   for my $field (keys(%$record))
   {
      next unless($field =~ $this->{'REGEX'});

      if(!exists($cookie->{$field}))
      {
         my $agg = $this->{'SNIPPET'}->evaluate_as('AGGREGATOR', {'$f' => $field});
         $cookie->{$field} = [$agg, $agg->initial()];
      }

      my ($agg, $sub_cookie) = @{$cookie->{$field}};

      $sub_cookie = $agg->combine($sub_cookie, $record);

      $cookie->{$field}->[1] = $sub_cookie;
   }

   return $cookie;
}

sub squish
{
   my $this   = shift;
   my $cookie = shift;

   for my $field (keys(%$cookie))
   {
      my ($agg, $sub_cookie) = @{$cookie->{$field}};
      $cookie->{$field} = $agg->squish($sub_cookie);
   }

   return $cookie;
}

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new', 'for_field', 'SCALAR', 'SNIPPET');

1;
