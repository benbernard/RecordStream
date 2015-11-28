package App::RecordStream::Operation::fromapache;

our $VERSION = "4.0.18";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;
use App::RecordStream::OptionalRequire qw(Apache::Log::Parser);
App::RecordStream::OptionalRequire::require_done();

sub init {
  my $this = shift;
  my $args = shift;

  my $fast;
  my $strict;
  my $verbose;
  my $woothee;

  my $spec = {
    "fast:s"   => \$fast,
    "strict:s" => \$strict,
    "verbose"  => \$verbose,
    "woothee"  => \$woothee,
  };

  $this->parse_options($args, $spec);

  my %opts;

  if (defined $fast) {
    if ($fast eq '') {
      $opts{fast} = 1;
    }
    else {
      $opts{fast} = eval $fast;
      die "eval of option fast failed. $@" if $@;
    }
  }

  if (defined $strict) {
    if ($strict eq '') {
      $opts{strict} = 1;
    }
    else {
      $opts{strict} = eval $strict;
      die "eval of option strict failed. $@" if $@;
    }
  }
  
  # default is --fast
  unless ($opts{fast} or $opts{strict}) {
    $opts{fast} = 1;
  }

  if ($verbose) {
    $opts{verbose} = 1;
  }

  if ($woothee) {
    App::RecordStream::OptionalRequire::optional_use("Woothee");
    App::RecordStream::OptionalRequire::require_done();
    $this->{'WOOTHEE'} = 1;
  }

  $this->{'PARSER'} = Apache::Log::Parser->new(%opts);
}

sub accept_line {
  my $this = shift;
  my $line = shift;

  my $parser = $this->{'PARSER'};

  if (my $hash = $parser->parse($line)) {
    my $record = App::RecordStream::Record->new($hash);
    $record->{woothee} = Woothee->parse($record->{agent}) if $this->{'WOOTHEE'};
    $this->push_record($record);
  }

  return 1;
}

sub usage {
  my $this = shift;

  my $options = [
    [ 'fast',    q{'fast' parser works relatively fast. It can process only 'common', 'combined' and custom styles with compatibility with 'common', and cannot work with backslash-quoted double-quotes in fields. (This is the default)} ],
    [ 'strict',  q{'strict' parser works relatively slow. It can process any style format logs, with specification about separator, and checker for perfection. It can also process backslash-quoted double-quotes properly.} ],
    [ 'verbose', q{Verbose output.} ],
    [ 'woothee', q{Each agent field of records is parse by Woothee to produce woothee field.} ],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-fromapache <args>
   __FORMAT_TEXT__
   Each line of input (or lines of <files>) is parse by Apache::Log::Parser to produce an output record.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Get records from typical apache log
      recs-fromapache < /var/log/httpd-access.log
   A more detailed how to use (See perldoc Apache::Log::Parser)
      recs-fromapache --strict '[qw(combined common vhost_common)]' < /var/log/httpd-access.log
   Get records except access of crawler
      recs-fromapache --woothee < /var/log/httpd-access.log | recs-grep '\$r->{woothee}{category} ne "crawler"'
USAGE
}

1;
