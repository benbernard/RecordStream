package App::RecordStream::Aggregator::UniqConcatenate;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base qw(App::RecordStream::Aggregator::Aggregation);

sub new
{
   my $class = shift;
   my $delim = shift;
   my $field = shift;

   return new_from_valuation($class, $delim, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation
{
   my $class = shift;
   my $delim = shift;
   my $valuation = shift;

   my $this =
   {
      'valuation' => $valuation,
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

   my $value = $this->{'valuation'}->evaluate_record($record);

   $cookie->{$value} = 1;

   return $cookie;
}

App::RecordStream::Aggregator::register_aggregator('uconcatenate', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('uconcat', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'uconcatenate', 'SCALAR', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'uconcat', 'SCALAR', 'VALUATION');

1;
