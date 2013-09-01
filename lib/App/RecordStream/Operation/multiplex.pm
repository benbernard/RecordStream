package App::RecordStream::Operation::multiplex;

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Clumper::Options;
use App::RecordStream::Operation::multiplex::BaseClumperCallback;

sub init {
  my $this = shift;
  my $args = shift;

  my $clumper_options = App::RecordStream::Clumper::Options->new();
  my $line_key = undef;

  my $spec = {
    $clumper_options->main_options(),

    # other options
    "line-key|L=s"          => \$line_key,

    # help
    $clumper_options->help_options(),
  };

  $this->parse_options($args, $spec);

  my ($script, @args) = @$args;
  @$args = ();

  # check help first
  $clumper_options->check_options(App::RecordStream::Operation::multiplex::BaseClumperCallback->new($script, \@args, $line_key, sub { return $this->push_record($_[0]); }, sub { return $this->push_line($_[0]); }));

  $this->{'CLUMPER_OPTIONS'} = $clumper_options;
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  $this->{'CLUMPER_OPTIONS'}->accept_record($record);
}

sub stream_done {
  my $this = shift;

  $this->{'CLUMPER_OPTIONS'}->stream_done();
}

sub print_usage {
  my $this    = shift;
  my $message = shift;

  if ( $message && UNIVERSAL::isa($message, 'CODE') ) {
    $message->();
    exit 1;
  }

  $this->SUPER::print_usage($message);
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('keyspecs');
  $this->use_help_type('keygroups');
  $this->use_help_type('keys');
  $this->use_help_type('domainlanguage');
  $this->use_help_type('clumping');
  $this->add_help_type(
    'more',
    sub { $this->more_help() },
    'Larger help documentation'
  );
}

sub usage {
  my $this = shift;

  my $options = [
    App::RecordStream::Clumper::Options->main_usage(),
    [ 'line-key|-L <key>', 'Use the value of this key as line input for the nested operation (rather than the entire record).  Use with recs-from* scripts generally.'],

    App::RecordStream::Clumper::Options->help_usage(),
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE
Usage: recs-multiplex <args> -- <other recs operation>
   __FORMAT_TEXT__
   Take records, grouped together by --keys, and run an operation for each
   group.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Separate out a stream of text by PID into separate invocations of recs-frommultire.
      recs-fromre '^(.*PID=([0-9]*).*)\$' -f line,pid | recs-multiplex -L line -k pid -- recs-frommultire ...
  Tag lines with counts by thread
      recs-multiplex -k thread -- recs-eval '{{nbr}} = ++\$nbr'
USAGE
}

sub more_help {
  my $this = shift;
  my $usage = $this->usage() . <<USAGE;

Cubing:
   __FORMAT_TEXT__
   Instead of added one entry for each input record, we add 2 ** (number of key
   fields), with every possible combination of fields replaced with the default
   of "ALL".  This is not meant to be used with --adjacent or --size.  If our
   key fields were x and y then we'd get output for {x = 1, y = 2}, {x = 1, y =
   ALL}, {x = ALL, y = 2} and {x = ALL, y = ALL}.
   __FORMAT_TEXT__

Domain Lanuage Integration:
USAGE
  $usage .= App::RecordStream::DomainLanguage::short_usage() . <<USAGE;

   __FORMAT_TEXT__
   Keys may be specified using the recs domain language.  --dlkey requires an
   option of the format '<name>=<domain language code>'.  --dlkey requires the
   code evaluate as a valuation.

   See --help-domainlanguage for a more complete description of its workings
   and a list of available functions.

   See the examples in the recs-collate help for a more gentle introduction.
   __FORMAT_TEXT__
USAGE
  print $this->format_usage($usage);
}

1;
