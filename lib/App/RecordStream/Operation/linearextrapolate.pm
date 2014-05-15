package App::RecordStream::Operation::linearextrapolate;

our $VERSION = "4.0.14";

use strict;
use warnings;

use base qw(App::RecordStream::Operation::Base::SimpleMultiplexHelper);

use App::RecordStream::Aggregator::LinearRegression;
use App::RecordStream::Operation::Base::SimpleMultiplexHelper;

sub init {
  my $this = shift;
  my $args = shift;

  my $x_key = undef;
  my $y_key = undef;
  my $yhat_key = undef;

  my $spec = {
    "x=s" => \$x_key,
    "y=s" => \$y_key,
    "yhat|yh=s" => \$yhat_key,
  };

  $this->parse_options($args, $spec);

  die "Missing -x" unless(defined($x_key));
  die "Missing -y" unless(defined($y_key));
  die "Missing --yhat" unless(defined($yhat_key));

  $this->{'X_KEY'} = $x_key;
  $this->{'Y_KEY'} = $y_key;
  $this->{'YHAT_KEY'} = $yhat_key;
}

sub _get_aggregators {
  my $this = shift;

  return {
    'R' => App::RecordStream::Aggregator::LinearRegression->new($this->{'X_KEY'}, $this->{'Y_KEY'}),
  };
}

sub _annotate_record {
  my $this = shift;
  my $record = shift;
  my $aggregates = shift;

  my $alpha = $aggregates->{'R'}->{'alpha'};
  my $beta = $aggregates->{'R'}->{'beta'};

  my $x = ${$record->guess_key_from_spec($this->{'X_KEY'})};
  ${$record->guess_key_from_spec($this->{'YHAT_KEY'})} = $alpha + $beta * $x;
}

sub usage {
  my $this = shift;

  my $options = [
    ['x <field>', 'Field to read independent variable from.'],
    ['y <field>', 'Field to read dependent variable from.'],
    ['yhat <field>', 'Field to write extrapolated dependent variable to.'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-linearextrapolate <args> [<files>]
   __FORMAT_TEXT__
   Calculates a linear regression and extrapolates values for records from input or from <files>.
   __FORMAT_TEXT__

$args_string

Examples:
   Extrapolate IQ from age with separate regressions for each name
      recs-multiplex -k name recs-linearextrapolate -x age -y iq --yhat iq_extrapolated
USAGE
}

1;
