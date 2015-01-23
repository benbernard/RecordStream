package App::RecordStream::Operation::assert;

our $VERSION = "4.0.12";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Executor::Getopt;
use App::RecordStream::Executor;
use Data::Dumper ();

sub init {
  my $this = shift;
  my $args = shift;

  $this->{DIAGNOSTIC} = '';
  $this->{VERBOSE}    = 0;

  my $executor_options = App::RecordStream::Executor::Getopt->new();
  my $spec = {
    'diagnostic|d=s' => \$this->{DIAGNOSTIC},
    'verbose|v'      => \$this->{VERBOSE},
    $executor_options->arguments(),
  };

  $this->parse_options($args, $spec, ['bundling']);

  my $expression = $executor_options->get_string($args);
  my $executor = App::RecordStream::Executor->new($expression);

  $this->{'ASSERTION'} = $expression;
  $this->{'EXECUTOR'}  = $executor;
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  unless ($this->{'EXECUTOR'}->execute_code($record)) {
    die "Assertion failed! $this->{DIAGNOSTIC}\n",
        "Expression: « $this->{ASSERTION} »\n",
        "Filename: ", $this->get_current_filename, "\n",
        "Line: $.\n",
        ($this->{VERBOSE}
          ? ("Record: ", Data::Dumper->Dump([$record->as_hashref], ['r']), "\n")
          : ());
  }

  $this->push_record($record);
  return 1;
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('snippet');
}

sub usage {
  my $this = shift;

  my $options = [
    ['diagnostic|-d <text>' => 'Include the diagnostic string <text> in any failed assertion errors'],
    ['verbose|-v'           => 'Verbose output for failed assertions; dumps the current record'],
    App::RecordStream::Executor::options_help(),
  ];

  my $args_string = $this->options_string($options);

  my $usage =  <<USAGE;
Usage: recs-assert <args> <expr> [<files>]
   __FORMAT_TEXT__
   Asserts that every record in the stream must pass the given <expr>.

   <expr> is evaluated as Perl on each record of input (or records from
   <files>) with \$r set to a App::RecordStream::Record object and \$line set
   to the current line number (starting at 1).  If <expr> does not evaluate to
   true, processing is immediately aborted and an error message printed.  See
   --help-snippets for more information on code snippets.
   __FORMAT_TEXT__

$args_string

Examples:
   Require each record to have a "date" field.
      recs-assert '\$r->{date}'
USAGE
}

1;
