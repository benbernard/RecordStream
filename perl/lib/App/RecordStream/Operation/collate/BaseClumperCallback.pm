package App::RecordStream::Operation::collate::BaseClumperCallback;

use strict;
use warnings;

use App::RecordStream::Aggregator;
use App::RecordStream::Record;

sub new {
  my $class = shift;
  my $aggregators = shift;
  my $incremental = shift;
  my $bucket = shift;
  my $record_cb = shift;

  my $this = {
    'AGGREGATORS' => $aggregators,
    'INCREMENTAL' => $incremental,
    'BUCKET' => $bucket,
    'RECORD_CB' => $record_cb,
  };
  bless $this, $class;

  return $this;
}

sub clumper_callback_begin {
  my $this = shift;
  my $bucket = shift;

  return [$bucket, $this->{'BUCKET'} ? undef : [], App::RecordStream::Aggregator::map_initial($this->{'AGGREGATORS'})];
}

sub clumper_callback_push_record {
  my $this = shift;
  my $cookie = shift;
  my $record = shift;

  push @{$cookie->[1]}, $record if(!$this->{'BUCKET'});
  $cookie->[2] = App::RecordStream::Aggregator::map_combine($this->{'AGGREGATORS'}, $cookie->[2], $record);

  if($this->{'INCREMENTAL'}) {
    $this->clumper_callback_end($cookie);
  }
}

sub clumper_callback_end {
  my $this = shift;
  my $cookie = shift;

  for my $proto_result ($this->{'BUCKET'} ? ($cookie->[0]) : @{$cookie->[1]}) {
    my $result = {
      # first, the bucket or original record
      %$proto_result,

      # then, the aggregators
      %{App::RecordStream::Aggregator::map_squish($this->{'AGGREGATORS'}, $cookie->[2])},
    };

    my $record = App::RecordStream::Record->new();

    for my $key (keys(%$result))
    {
      my $value = $result->{$key};

      ${$record->guess_key_from_spec($key)} = $value;
    }

    $this->{'RECORD_CB'}->($record);
  }
}

1;
