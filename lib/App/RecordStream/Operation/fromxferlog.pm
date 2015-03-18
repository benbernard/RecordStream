package App::RecordStream::Operation::fromxferlog;

our $VERSION = "4.0.13";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;
use App::RecordStream::OptionalRequire qw(Net::FTPServer::XferLog);
App::RecordStream::OptionalRequire::require_done();

sub init {
  my $this = shift;
  my $args = shift;

  my $spec = {};

  $this->parse_options($args, $spec);
}

sub accept_line {
  my $this = shift;
  my $line = shift;

  if (my $hash = Net::FTPServer::XferLog->parse_line($line)) {
    my $record = App::RecordStream::Record->new($hash);
    $this->push_record($record);
  }

  return 1;
}

sub usage {
  my $this = shift;

  return <<USAGE;
Usage: recs-fromxferlog <args>
   __FORMAT_TEXT__
   Each line of input (or lines of <files>) is parse by Net::FTPServer::XferLog to produce an output record.
   __FORMAT_TEXT__

Examples:
   Get records from typical xferlog
      recs-fromxferlog < /var/log/xferlog
USAGE
}

1;
