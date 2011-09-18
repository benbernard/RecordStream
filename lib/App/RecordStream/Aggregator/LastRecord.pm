package App::RecordStream::Aggregator::LastRecord;

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::Aggregator::InjectInto;
use App::RecordStream::DomainLanguage::Registry;

use base qw(App::RecordStream::Aggregator::InjectInto);

sub new
{
   my $class = shift;
   my @args  = @_;

   return $class->SUPER::new(@args);
}

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
   print "Usage: last_record\n";
   print "   Last record seen.\n";
   exit 1;
}

sub returns_record
{
   return 1;
}

sub argct
{
   return 0;
}

App::RecordStream::Aggregator::register_aggregator('lastrecord', __PACKAGE__);
App::RecordStream::Aggregator::register_aggregator('lastrec', __PACKAGE__);

App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'lastrecord');
App::RecordStream::DomainLanguage::Registry::register_ctor(__PACKAGE__, 'lastrec');

1;
