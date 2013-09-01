package App::RecordStream::Operation::multiplex::BaseClumperCallback;

use strict;
use warnings;

use App::RecordStream::Operation;
use App::RecordStream::Record;
use App::RecordStream::Stream::Sub;

sub new {
  my $class = shift;
  my $script = shift;
  my $args = shift;
  my $line_key = shift;
  my $record_cb = shift;
  my $line_cb = shift;

  my $this = {
    'SCRIPT' => $script,
    'ARGS' => $args,
    'LINE_KEY' => $line_key,
    'RECORD_CB' => $record_cb,
    'LINE_CB' => $line_cb,
  };
  bless $this, $class;

  return $this;
}

sub clumper_callback_begin {
  my $this = shift;
  my $bucket = shift;

  my $record_cb = $this->{'RECORD_CB'};
  my $record_cb2 = sub {
    my $r = shift;

    return $record_cb->(App::RecordStream::Record->new(%$r, %$bucket));
  };
  my $next = App::RecordStream::Stream::Sub->new($record_cb2, $this->{'LINE_CB'});
  my @args = @{$this->{'ARGS'}};
  my $op = App::RecordStream::Operation::create_operation($this->{'SCRIPT'}, \@args, $next);

  if(@args) {
    die "Extra options to multiplex operation.";
  }
  if(!$op->wants_input()) {
    die "Multiplex operation must want input.";
  }

  return $op;
}

sub clumper_callback_push_record {
  my $this = shift;
  my $op = shift;
  my $record = shift;

  my $line_key = $this->{'LINE_KEY'};
  if(defined($line_key)) {
    $op->accept_line(${$record->guess_key_from_spec($line_key)});
  }
  else {
    $op->accept_record($record);
  }
}

sub clumper_callback_end {
  my $this = shift;
  my $op = shift;
  $op->finish();
}

1;
