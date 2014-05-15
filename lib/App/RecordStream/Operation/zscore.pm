package App::RecordStream::Operation::zscore;

our $VERSION = "4.0.14";

use strict;
use warnings;

use base qw(App::RecordStream::Accumulator App::RecordStream::Operation);

use App::RecordStream::Aggregator;
use App::RecordStream::Operation;

sub init {
  my $this = shift;
  my $args = shift;

  my $v_key = undef;
  my $z_key = undef;

  my $spec = {
    "value|v=s" => \$v_key,
    "zscore|z=s" => \$z_key,
  };

  $this->parse_options($args, $spec);

  die "Missing -v" unless(defined($v_key));
  die "Missing -z" unless(defined($z_key));

  $this->{'V_KEY'} = $v_key;
  $this->{'Z_KEY'} = $z_key;
}

sub stream_done {
  my $this = shift;

  my $v_key = $this->{'V_KEY'};
  my $z_key = $this->{'Z_KEY'};

  my $records = $this->get_records();

  return unless(@$records);
  my $count = 0;
  my $sum = 0;
  for my $record (@$records) {
    my $v = ${$record->guess_key_from_spec($v_key)};
    $count += 1;
    $sum += $v;
  }
  my $average = $sum / $count;
  my $sum_squared_error = 0;
  for my $record (@$records) {
    my $v = ${$record->guess_key_from_spec($v_key)};
    $sum_squared_error += ($v - $average) ** 2;
  }
  my $variance = $sum_squared_error / $count;
  my $sd = sqrt($variance);
  for my $record (@$records) {
    my $v = ${$record->guess_key_from_spec($v_key)};
    ${$record->guess_key_from_spec($z_key)} = ($v - $average) / $sd;
    $this->push_record($record);
  }
}

sub usage {
  my $this = shift;

  my $options = [
    ['value|-v <field>', 'Field to read value from.'],
    ['zscore|-z <field>', 'Field to write zscore to.'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-zscore <args> [<files>]
   __FORMAT_TEXT__
   Calculates zscores for records from input or from <files>.
   __FORMAT_TEXT__

$args_string

Examples:
   Assign each record a zscore within its classroom
      recs-multiplex -k classroom recs-zscore -v score -z zscore
USAGE
}

1;
