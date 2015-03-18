package App::RecordStream::Operation::togdgraph;

our $VERSION = "4.0.13";

use strict;
use warnings;

use App::RecordStream::OptionalRequire qw(GD::Graph::lines);
use App::RecordStream::OptionalRequire qw(GD::Graph::bars);
use App::RecordStream::OptionalRequire qw(GD::Graph::points);
App::RecordStream::OptionalRequire::require_done();

use base qw(App::RecordStream::Operation);

my $GD_TYPES = {
  'line'    => 'lines',
  'scatter' => 'points',
  'bar'     => 'bars'
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

  my $dump_use_spec;

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
    'height=i'           => \$height,
    'dump-use-spec'      => \$dump_use_spec
  };
  $this->parse_options($args, $cmdspec);

  if ( ! $GD_TYPES->{$graph_type} ) {
    die "Unsupported graph type: $graph_type\n";
  }

  $this->{'DUMP_USE_SPEC'}    = $dump_use_spec;

  $this->{'LABEL_X'}          = $label_x;
  $this->{'LABEL_Y'}          = $label_y;
  $this->{'TITLE'}            = $title unless !$this->{'TITLE'};

  $this->{'GDGRAPH_OPTIONS'}  = \@additional_options;
  $this->{'KEYGROUPS'}        = $key_groups;
  $this->{'FIRST_RECORD'}     = 1;

  $this->{'GRAPH_TYPE'}       = $graph_type;
  $this->{'WIDTH'}            = $width;
  $this->{'HEIGHT'}           = $height;
  $this->{'PNG_FILE'}         = $png_file;

  if ( $dump_use_spec ) {
    $this->push_line('x label: '.$title) unless !$this->{'LABEL_X'};
    $this->push_line('y label: '.$title) unless !$this->{'LABEL_Y'};
    $this->push_line('title: '.$title) unless !$this->{'TITLE'};
    $this->push_line('type: '.$graph_type);
    $this->push_line('width: '.$width);
    $this->push_line('height: '.$height);
    $this->push_line('output file: '.$png_file);
  }
}

sub init_fields {
  my ($this, $record) = @_;

  my $specs = $this->{'KEYGROUPS'}->get_keyspecs($record);
  if ( $this->{'DUMP_USE_SPEC'} ) {
    foreach my $sfield (@{$specs}) {
      $this->push_line('field: '.$sfield);
    }
  }
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

  my @record_spec;
  foreach my $key (@{$this->{'FIELDS'}}) {
    push @{$this->{'PLOTDATA'}->{$key}}, $record->{$key};
    push @record_spec, $record->{$key};
  }
  if ( $this->{'DUMP_USE_SPEC'} ) {
    $this->push_line(join(' ',@record_spec));
  }

  return 1;
}

sub stream_done {
  my $this = shift;

  my $gdhnd;
  my $w = $this->{'WIDTH'};
  my $h = $this->{'HEIGHT'};

  my $gtype = 'GD::Graph::'.$GD_TYPES->{$this->{'GRAPH_TYPE'}};
  $gdhnd = $gtype->new($w,$h);

  $gdhnd->set(
    x_label => $this->{'LABEL_X'},
    y_label => $this->{'LABEL_Y'}
  );

  if ( $this->{'TITLE'} ) {
    $gdhnd->set( title => $this->{'TITLE'} );
  }

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
  open(IMG, '>', $this->{'PNG_FILE'}) or die "Could not open file for writing $this->{PNG_FILE}: $!";
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
    ['key|-k|--key <keyspec>', 'Specify keys that correlate to keys in JSON data'],
    ['option|-o option=val', 'Specify custom command for GD::Graph'],
    ['label-x <val>', 'Specify X-axis label'],
    ['label-y <val>', 'Specify Y-axis label'],
    ['width <val>', 'Specify width'],
    ['height <val>', 'Specify height'],
    ['graph-title <val>', 'Specify graph title'],
    ['type <val>', 'Specify different graph type other than scatter (supported: line, bar)'],
    ['png-file <val>', 'Specify output PNG filename'],
    ['dump-use-spec <val>', 'Dump GD usage (used mainly for testing)']
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-togdgraph <args> [<files>]
  __FORMAT_TEXT__
  Create a bar, scatter, or line graph using GD::Graph.
  __FORMAT_TEXT__

Args:
$args_string

Examples:
  for a plain point graph:

  recs-togdgraph --keys uid,ct --png-file login-graph.png --graph-title '# of logins' --label-x user --label-y logins

  togdgraph also accepts any GD::Graph options with the --option command...
  for a pink background with yellow label text if that really is your thing:

  recs-togdgraph --keys uid,ct --option boxclr=pink --label-y 'logins' --label-x 'user' --option labelclr=yellow

  however, for a different graph type such as line or bar, specify with --type:

  recs-togdgraph --keys uid,ct --type line
USAGE
}

1;
