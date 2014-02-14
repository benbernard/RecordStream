package App::RecordStream::Aggregator::FirstRecord;

our $VERSION = "4.0.4";

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

  return $record unless ( defined $cookie );

  return $cookie;
}

sub short_usage
{
  return "first record";
}

sub long_usage
{
  return <<EOF;
Usage: first
   Returns the first record.
EOF
}

sub argct
{
  return 0;
}

App::RecordStream::Aggregator->register_implementation('firstrecord', __PACKAGE__);
App::RecordStream::Aggregator->register_implementation('firstrec', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'firstrecord');
App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'firstrec');

1;
