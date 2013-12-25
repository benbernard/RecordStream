package App::RecordStream::Operation::eval;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Executor::Getopt;
use App::RecordStream::Executor;

# TODO: if we want --no-newline back we'll need to change push_line to push_text, make Stream::Base stateful (spooling text to parse lines to parse records), etc.

sub init {
  my $this = shift;
  my $args = shift;

  my $chomp = 0;
  my $executor_options = App::RecordStream::Executor::Getopt->new();
  my $spec = {
    'chomp' => \$chomp,
    $executor_options->arguments(),
  };

  Getopt::Long::Configure("bundling");
  $this->parse_options($args, $spec);

  my $expression = $executor_options->get_string($args);
  my $executor = App::RecordStream::Executor->new($expression);

  $this->{'EXECUTOR'} = $executor;
  $this->{'CHOMP'} = $chomp;
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my $executor = $this->{'EXECUTOR'};
  my $value = $executor->execute_code($record);

  chomp $value if($this->{'CHOMP'});

  $this->push_line($value);

  return 1;
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('snippet');
  $this->use_help_type('keyspecs');
}

sub usage {
  my $this = shift;

  my $options = [
    App::RecordStream::Executor::options_help(),
    ['chomp', 'Chomp eval results (to avoid duplicate newlines when already newline-terminated)'],
  ];

  my $args_string = $this->options_string($options);

  my $usage =  <<USAGE;
Usage: recs-eval <args> <expr> [<files>]
   __FORMAT_TEXT__
   <expr> is evaluated as perl on each record of input (or records from
   <files>) with \$r set to a App::RecordStream::Record object and \$line set
   to the current line number (starting at 1).  The result of each evaluation
   is printed on a line by itself (this is not a recs stream).  See
   App::RecordStream::Record for help on what the \$r object can do.  See
   --help-snippets for more information on code snippets
   __FORMAT_TEXT__

$args_string

Examples:
   Print the host field from each record.
      recs-eval '\$r->{host}'
   Prepare to gnuplot field y against field x.
      recs-eval '\$r->{x} . " " . \$r->{y}'
   Set up a script (this would be presumably piped to sh)
      recs-eval '"./myscript --value \$r->{foo}"'
USAGE
}

1;
