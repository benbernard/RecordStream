package App::RecordStream::Aggregator::DistinctCount;

use strict;
use lib;

use App::RecordStream::Aggregator;
use base qw(App::RecordStream::Aggregator::Aggregation);

sub new
{
   my $class = shift;
   my ($field) = @_;

   my $this =
   {
      'field' => $field,
   };
   bless $this, $class;

   return $this;
}

sub squish
{
   my ($this, $cookie) = @_;

   return scalar(keys(%$cookie));
}

sub short_usage
{
   return "count unique values from provided field";
}

sub long_usage
{
   print <<USAGE;
Usage: dct,<field>
   Finds the number of unique values for a field and returns it.  Will load all
   values into memory.
USAGE

   exit 1
}

sub argct
{
   return 1;
}

sub initial
{
   return {};
}

sub combine
{
   my ($this, $cookie, $record) = @_;

   my $value = ${$record->guess_key_from_spec($this->{'field'})};
   $cookie->{$value} = 1;

   return $cookie;
}

App::RecordStream::Aggregator::register_aggregator('dcount', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('dct', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('distinctcount', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('distinctct', __PACKAGE__);

1;
