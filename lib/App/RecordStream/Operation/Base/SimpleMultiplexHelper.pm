package App::RecordStream::Operation::Base::SimpleMultiplexHelper;

our $VERSION = "4.0.14";

use strict;
use warnings;

use base qw(App::RecordStream::Accumulator App::RecordStream::Operation);

use App::RecordStream::Accumulator;
use App::RecordStream::Aggregator;
use App::RecordStream::Operation;

sub stream_done {
  my $this = shift;

  my $records = $this->get_records();

  return unless(@$records);

  my $aggregators = $this->_get_aggregators();
  my $cookie = App::RecordStream::Aggregator::map_initial($aggregators);

  for my $record (@$records) {
    $cookie = App::RecordStream::Aggregator::map_combine($aggregators, $cookie, $record);
  }

  my $aggregates = App::RecordStream::Aggregator::map_squish($aggregators, $cookie);
  for my $record (@$records) {
    $this->_annotate_record($record, $aggregates);
    $this->push_record($record);
  }
}

1;
