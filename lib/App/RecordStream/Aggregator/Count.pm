package App::RecordStream::Aggregator::Count;

our $VERSION = "4.0.16";

use strict;
use warnings;

use App::RecordStream::Aggregator::MapReduce;
use App::RecordStream::Aggregator;
use App::RecordStream::DomainLanguage::Registry;

use base 'App::RecordStream::Aggregator::MapReduce';

sub map
{
  return 1;
}

sub reduce
{
  my ($this, $cookie, $cookie2) = @_;

  return $cookie + $cookie2;
}

sub argct
{
  return 0;
}

sub long_usage
{
  return <<EOF;
Usage: count
   Counts number of (non-unique) records.
EOF
}

sub short_usage
{
  return "counts (non-unique) records";
}

App::RecordStream::Aggregator->register_implementation('count', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('ct', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'count');
App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'ct');

1;
