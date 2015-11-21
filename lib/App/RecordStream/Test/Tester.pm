package App::RecordStream::Test::Tester;

our $VERSION = "4.0.17";

use strict;
use warnings;

use App::RecordStream::Test::OperationHelper;

sub new {
  my $class     = shift;
  my $operation = shift;

  my $this = {
    OPERATION => $operation,
  };

  bless $this, $class;
  return $this;
}

sub no_input_test {
  my $this   = shift;
  my $args   = shift;
  my $output = shift;

  return App::RecordStream::Test::OperationHelper->do_match(
    $this->{'OPERATION'},
    $args,
    undef,
    $output,
  );
}

sub test_input {
  my $this   = shift;
  my $args   = shift;
  my $input  = shift;
  my $output = shift;

  return App::RecordStream::Test::OperationHelper->do_match(
    $this->{'OPERATION'},
    $args,
    ['LINES', split(/\n/, $input)],
    $output,
  );
}

sub test_stdin {
  my $this   = shift;
  my $args   = shift;
  my $input  = shift;
  my $output = shift;

  # Re-open stdin to the given input
  close(STDIN) or die "Cannot close STDIN: $!";
  open(STDIN, "<", \$input) or die "Cannot re-open STDIN to string ref: $!";

  return App::RecordStream::Test::OperationHelper->do_match(
    $this->{'OPERATION'},
    $args,
    undef,
    $output,
  );
}

1;
