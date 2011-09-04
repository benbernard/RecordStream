package App::RecordStream::Aggregator::Internal::ForField2;

use strict;
use lib;

use App::RecordStream::Aggregator::Aggregation;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::Aggregation';

sub new
{
   my $class = shift;
   my $regex1 = shift;
   my $regex2 = shift;
   my $snippet = shift;

   my $this =
   {
      'REGEX1' => $regex1,
      'REGEX2' => $regex2,
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

   my @field1;
   my @field2;
   for my $field (keys(%$record))
   {
      push @field1, $field if($field =~ $this->{'REGEX1'});
      push @field2, $field if($field =~ $this->{'REGEX2'});
   }

   for my $field1 (@field1)
   {
      for my $field2 (@field2)
      {
         my $fieldc = "$field1,$field2";

         if(!exists($cookie->{$fieldc}))
         {
            my $agg = $this->{'SNIPPET'}->evaluate_as('AGG', {'$f1' => $field1, '$f2' => $field2});
            $cookie->{$fieldc} = [$agg, $agg->initial()];
         }

         my ($agg, $sub_cookie) = @{$cookie->{$fieldc}};

         $sub_cookie = $agg->combine($sub_cookie, $record);

         $cookie->{$fieldc}->[1] = $sub_cookie;
      }
   }

   return $cookie;
}

sub squish
{
   my $this   = shift;
   my $cookie = shift;

   for my $fieldc (keys(%$cookie))
   {
      my ($agg, $sub_cookie) = @{$cookie->{$fieldc}};
      $cookie->{$fieldc} = $agg->squish($sub_cookie);
   }

   return $cookie;
}

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new', 'for_field', 'SCALAR', 'SCALAR', 'SNIPPET');

1;
