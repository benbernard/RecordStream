use strict;
use warnings;

package App::RecordStream::Operation::help;
use base qw(App::RecordStream::Operation);

use Carp qw< croak >;

sub usage {
  my $this = shift;
  my $args_string = $this->options_string([]);

  return <<USAGE;
Usage: recs help <command-name>
       recs help <option>
   __FORMAT_TEXT__
   Show help for the given command or options.  Equivalent to using `recs
   command --help` and friends.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Show help for fromcsv command
      recs help fromcsv
   Show help for code snippets
      recs help --snippet
USAGE
}

sub init_help {
  my $this = shift;
  $this->SUPER::init_help(@_);

  # Make all help types available, sans the redundant "help-" prefix
  for my $type (keys %{ $this->{'HELP_TYPES'} }) {
    $this->use_help_type($type);
    $this->{'HELP_TYPES'}{$type}{OPTION_NAME} ||= $type;
  }
}

sub init {
  my $this = shift;
  my $args = shift;
  $this->parse_options($args, {});

  my $op = shift @$args;
  if ($op) {
    # Command help
    local @ARGV = ("--help");
    App::RecordStream::Operation::main("recs-$op");
  } else {
    # Option help
    $this->_set_wants_help(1);
  }
}

sub wants_input { 0 }
sub accept_line {
  croak "This operation does not accept input.";
}

1;
