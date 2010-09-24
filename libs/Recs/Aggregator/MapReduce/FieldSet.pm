package Recs::Aggregator::MapReduce::FieldSet;

use strict;
use lib;

use Recs::Aggregator::MapReduce;

use base 'Recs::Aggregator::MapReduce';

sub new
{
   my $class = shift;

   my $this =
   {
      'fields' => \@_,
   };
   bless $this, $class;

   return $this;
}

sub map
{
   my ($this, $record) = @_;

   return $this->map_fields(map { ${$record->guess_key_from_spec($_)} } @{$this->{'fields'}});
}

sub map_fields
{
   die "FieldSet subclass does not implement map_fields\n";
}

1;
