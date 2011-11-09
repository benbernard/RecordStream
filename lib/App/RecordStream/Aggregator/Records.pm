package App::RecordStream::Aggregator::Records;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::MapReduce';

sub new
{
  my $class = shift;

  my $this =
  {
  };

  bless $this, $class;

  return $this;
}

sub map
{
  my ($this, $record) = @_;

  return [$record];
}

sub reduce
{
  my ($this, $cookie1, $cookie2) = @_;

  return [@$cookie1, @$cookie2];
}

sub argct
{
  return 0;
}

sub short_usage
{
  return "returns an arrayref of all records";
}

sub long_usage
{
  return <<EOF;
Usage: records
   An arrayref of all records.
EOF
}

App::RecordStream::Aggregator::register_aggregator('records', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('recs', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'records');
App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'recs');

1;
