package App::RecordStream::Aggregator::UniqConcatenate;

use strict;
use lib;

use App::RecordStream::Aggregator;
use base qw(App::RecordStream::Aggregator::Aggregation);

sub new
{
   my ($class, $delim, $field) = @_;

   my $this =
   {
      'field' => $field,
      'delim' => $delim,
   };
   bless $this, $class;

   return $this;
}

sub squish
{
   my ($this, $cookie) = @_;

   return join($this->{'delim'}, sort(keys(%$cookie)));
}

sub long_usage
{
   print "Usage: uconcat,<delimiter>,<field>\n";
   print "   Concatenate unique values from specified field.\n";
   exit 1;
}

sub short_usage
{
   return "concatenate unique values from provided field";
}

sub argct
{
   return 2;
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

App::RecordStream::Aggregator::register_aggregator('uconcatenate', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('uconcat', __PACKAGE__);

1;
