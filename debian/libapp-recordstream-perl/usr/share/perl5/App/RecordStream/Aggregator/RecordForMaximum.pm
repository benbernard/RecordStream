package App::RecordStream::Aggregator::RecordForMaximum;

our $VERSION = "3.4";

use strict;
use lib;

use App::RecordStream::Aggregator::MapReduce;
use App::RecordStream::DomainLanguage::Registry;
use App::RecordStream::DomainLanguage::Valuation::KeySpec;

use base 'App::RecordStream::Aggregator::MapReduce';

sub new
{
    my $class = shift;
    my $field = shift;

    return new_from_valuation($class, App::RecordStream::DomainLanguage::Valuation::KeySpec->new($field));
}

sub new_from_valuation
{
   my $class = shift;
   my ($valuation) = @_;

   my $this =
   {
      'valuation' => $valuation,
   };
   bless $this, $class;

   return $this;
}

sub map
{
   my ($this, $record) = @_;

   my $value = $this->{'valuation'}->evaluate_record($record);

   return [$value, $record];
}

sub reduce
{
   my ($this, $cookie1, $cookie2) = @_;

   my ($v1, $r1) = @$cookie1;
   my ($v2, $r2) = @$cookie2;

   if($v1 > $v2)
   {
      return $cookie1;
   }

   return $cookie2;
}

sub squish
{
   my ($this, $cookie) = @_;

   my ($v, $r) = @$cookie;

   return $r;
}

sub argct
{
   return 1;
}

sub short_usage
{
   return "returns the record corresponding to the maximum value for a field";
}

sub long_usage
{
   print "Usage: recformax,<field>\n";
   print "   The record corresponding to the maximum value of specified field.\n";
   exit 1;
}

sub returns_record
{
   return 1;
}

App::RecordStream::Aggregator::register_aggregator('recformax', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('recformaximum', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('recordformax', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('recordformaximum', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'recformax', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'recformaximum', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'recordformax', 'VALUATION');
App::RecordStream::DomainLanguage::Registry::register_vfn(__PACKAGE__, 'new_from_valuation', 'recordformaximum', 'VALUATION');

1;
