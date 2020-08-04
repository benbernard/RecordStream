package App::RecordStream::Operation::zscore;

our $VERSION = "4.0.14";

use strict;
use warnings;

use base qw(App::RecordStream::Operation::Base::SimpleMultiplexHelper);

use App::RecordStream::Aggregator::Average;
use App::RecordStream::Aggregator::StandardDeviation;
use App::RecordStream::Operation::Base::SimpleMultiplexHelper;

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

sub _get_aggregators {
  my $this = shift;

  return {
    'AVERAGE' => App::RecordStream::Aggregator::Average->new($this->{'V_KEY'}),
    'SD' => App::RecordStream::Aggregator::StandardDeviation->new($this->{'V_KEY'}),
  };
}

sub _annotate_record {
  my $this = shift;
  my $record = shift;
  my $aggregates = shift;

  my $average = $aggregates->{'AVERAGE'};
  my $sd = $aggregates->{'SD'};

  my $v = ${$record->guess_key_from_spec($this->{'V_KEY'})};
  ${$record->guess_key_from_spec($this->{'Z_KEY'})} = ($v - $average) / $sd;
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
