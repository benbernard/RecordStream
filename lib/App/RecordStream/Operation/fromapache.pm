package App::RecordStream::Operation::fromapache;

our $VERSION = "4.0.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;
use App::RecordStream::OptionalRequire qw(Apache::Log::Parser);
App::RecordStream::OptionalRequire::require_done();

sub init {
  my $this = shift;
  my $args = shift;

  my $fast    = 0;
  my $strict  = 0;
  my $verbose = 0;

  my $spec = {
    "fast"    => \$fast,
    "strict"  => \$strict,
    "verbose" => \$verbose,
  };

  $this->parse_options($args, $spec);

  $this->{'PARSER'} = Apache::Log::Parser->new(
      ( $fast    ? ( fast    => eval $fast   ) : () ),
      ( $strict  ? ( strict  => eval $strict ) : () ),
      ( $verbose ? ( verbose => $verbose     ) : () ),
  );
}

sub accept_line {
  my $this = shift;
  my $line = shift;

  my $parser = $this->{'PARSER'};

  if (my $hash = $parser->parse($line)) {
    my $record = App::RecordStream::Record->new($hash);
    $this->push_record($record);
  }

  return 1;
}

sub usage {
  my $this = shift;

  my $options = [
    [ 'fast',    q{'fast' parser works relatively fast. It can process only 'common', 'combined' and custom styles with compatibility with 'common', and cannot work with backslash-quoted double-quotes in fields.} ],
    [ 'strict',  q{'strict' parser works relatively slow. It can process any style format logs, with specification about separator, and checker for perfection. It can also process backslash-quoted double-quotes properly.} ],
    [ 'verbose', q{Verbose output.} ],
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
      recs-fromapache --fast < /var/log/httpd-access.log
   A more detailed how to use
      recs-fromapache --strict '[qw(combined common vhost_common)]' < /var/log/httpd-access.log
USAGE
}

1;
