package App::RecordStream::Operation::togdgraph;

our $VERSION = "3.4";

use strict;
use warnings;

use Data::Dumper;
use GD::Graph::lines;
use GD::Graph::bars;
use GD::Graph::points;
use base qw(App::RecordStream::Operation);

my $GD_TYPES = {
  'line' => 'lines',
  'scatter' => 'points',
  'bar' => 'bars'
};

sub init {
  my $this = shift;
  my $args = shift;

  my $png_file = 'togdgraph.png';
  my $title;
  my $label_x;
  my $label_y;
  my @additional_options;
  my $graph_type = 'scatter';
  my $width = 600;
  my $height = 300;

  my $key_groups = App::RecordStream::KeyGroups->new();

  my $cmdspec = {
    'key|k|fields|f=s'   => sub { $key_groups->add_groups($_[1]); },
    'option|o=s'         => sub { push @additional_options, [split(/=/, $_[1])]; },
    'label-x=s'          => \$label_x,
    'label-y=s'          => \$label_y,
    'graph-title=s'      => \$title,
    'png-file=s'         => \$png_file,
    'type=s'             => \$graph_type,
    'width=i'            => \$width,
    'height=i'           => \$height
  };
  $this->parse_options($args, $cmdspec);

  if ( ! $GD_TYPES->{$graph_type} ) {
    print "Unsupported graph type: $graph_type\n";
  }

  $this->{'LABEL_X'} = $label_x;
  $this->{'LABEL_Y'} = $label_y;
  $this->{'TITLE'} = $title;
  $this->{'GDGRAPH_OPTIONS'} = \@additional_options;
  $this->{'KEYGROUPS'} = $key_groups;
  $this->{'FIRST_RECORD'} = 1;
  $this->{'GRAPH_TYPE'} = $graph_type;
  $this->{'WIDTH'} = $width;
  $this->{'HEIGHT'} = $height;
  $this->{'PNG_FILE'} = $png_file;
}

sub init_fields {
  my ($this, $record) = @_;

  my $specs = $this->{'KEYGROUPS'}->get_keyspecs($record);
  $this->{'FIELDS'} = $specs;

  $this->{'PLOTDATA'} = ();
  foreach my $fkey (@{$this->{'FIELDS'}}) {
    $this->{'PLOTDATA'}->{$fkey} = [];
  }
}

sub accept_record {
  my $this = shift;
  my $record = shift;

  if ( $this->{'FIRST_RECORD'} ) {
    $this->{'FIRST_RECORD'} = 0;
    $this->init_fields($record);
  }

  foreach my $key (@{$this->{'FIELDS'}}) {
    push @{$this->{'PLOTDATA'}->{$key}}, $record->{$key};
  }

  return 1;
}

sub stream_done {
  my $this = shift;

  my $gdhnd;
  my $w = $this->{'WIDTH'};
  my $h = $this->{'HEIGHT'};

  if ( $this->{'GRAPH_TYPE'} eq 'scatter' ) {
    $gdhnd = GD::Graph::points->new($w,$h);
  } elsif ( $this->{'GRAPH_TYPE'} eq 'line' ) {
    $gdhnd = GD::Graph::lines->new($w,$h);
  } elsif ( $this->{'GRAPH_TYPE'} eq 'bar' ) {
    $gdhnd = GD::Graph::bars->new($w,$h);
  }

  $gdhnd->set(
    title => $this->{'TITLE'},
    x_label => $this->{'LABEL_X'},
    y_label => $this->{'LABEL_Y'}
  );

  foreach my $kv (@{$this->{'GDGRAPH_OPTIONS'}}) {
    $gdhnd->set( $kv->[0] => $kv->[1] );
  }

  my @data;

  if ( scalar(keys %{$this->{'PLOTDATA'}}) == 1 ) {
    my @hkey = keys(%{$this->{'PLOTDATA'}});
    my $arrsize = scalar @{$this->{'PLOTDATA'}->{$hkey[0]}};
    push @data, [ 1 .. $arrsize ];
    push @data, $this->{'PLOTDATA'}->{$hkey[0]};
  } else {
    for my $field (@{$this->{'FIELDS'}}) {
      push @data, $this->{'PLOTDATA'}->{$field};
    }
  }
  my $gd = $gdhnd->plot(\@data);
  if ( !$gd ) {
    print "could not plot data\n";
    exit;
  }
  open(IMG, '>'.$this->{'PNG_FILE'}) or die $!;
  binmode IMG;
  print IMG $gd->png;
  close IMG;
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('keyspecs');
  $this->use_help_type('keygroups');
  $this->use_help_type('keys');
}

sub usage {
  my $this = shift;

  my $options = [
    ['command|-c option=val', 'Specify custom command for GD::Graph'],
    ['label-x <val>', 'Specify X-axis label'],
    ['label-y <val>', 'Specify Y-axis label'],
    ['width <val>', 'Specify width'],
    ['height <val>', 'Specify height'],
    ['graph-title <val>', 'Specify graph title'],
    ['png-file <val>', 'Specify output PNG file']
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-togdgraph <args> [<files>]
  __FORMAT_TEXT__
  Create a bar, scatter, or line graph using GD::Graph.
  __FORMAT_TEXT__

Args:
$args_string

USAGE
}

1;
