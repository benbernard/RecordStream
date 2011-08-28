package App::RecordStream::Aggregator::MapReduce::FieldSet;

our $VERSION = "3.4";

use strict;
use lib;

use App::RecordStream::Aggregator::MapReduce;

use base 'App::RecordStream::Aggregator::MapReduce';

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
