package App::RecordStream::Aggregator::LastRecord;

our $VERSION = "4.0.12";

use strict;
use warnings;

use App::RecordStream::Aggregator::InjectInto;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto);

sub combine
{
  my $this   = shift;
  my $cookie = shift;
  my $record  = shift;

  return $record;
}

sub short_usage
{
  return "last record seen";
}

sub long_usage
{
  return <<EOF;
Usage: last_record
   Last record seen.
EOF
}

sub argct
{
  return 0;
}

App::RecordStream::Aggregator->register_implementation('lastrecord', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('lastrec', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'lastrecord');
App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'lastrec');

1;
