package App::RecordStream::Clumper::WrappedClumperCallback;

use strict;
use warnings;

use App::RecordStream::Aggregator;
use App::RecordStream::Record;

sub new {
  my $class = shift;
  my $clumper = shift;
  my $next = shift;

  my $this = {
    'CLUMPER' => $clumper,
    'NEXT' => $next,
  };
  bless $this, $class;

  return $this;
}

sub clumper_callback_begin {
  my $this = shift;
  my $bucket = shift;

  return $this->{'CLUMPER'}->clumper_begin($bucket);
}

sub clumper_callback_push_record {
  my $this = shift;
  my $cookie = shift;
  my $record = shift;

  return $this->{'CLUMPER'}->clumper_push_record($cookie, $record, $this->{'NEXT'});
}

sub clumper_callback_end {
  my $this = shift;
  my $cookie = shift;

  return $this->{'CLUMPER'}->clumper_end($cookie, $this->{'NEXT'});
}

1;
