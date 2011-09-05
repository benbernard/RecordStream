package App::RecordStream::Operation::tognuplot;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation App::RecordStream::ScreenPrinter);

use File::Temp qw(tempfile);

sub init {
   my $this = shift;
   my $args = shift;

   my $bar_graph;
   my $dump_to_screen = 0;
   my $gnuplot_command = 'gnuplot';
   my $lines;
   my $png_file = 'tognuplot.png';
   my $title;
   my @labels;
   my @plots;
   my @precommands;
   my @using;

   my $key_groups = App::RecordStream::KeyGroups->new();

   my $spec = {
      "file=s"            => \$png_file,
      "key|k|fields|f=s"  => sub { $key_groups->add_groups($_[1]); },
      "label=s"           => sub { push @labels, split(/,/, $_[1]); },
      "plot=s"            => sub { push @plots, split(/,/, $_[1]); },
      "precommand=s"      => sub { push @precommands, split(/,/, $_[1]); },
      "title=s"           => \$title,
      "using=s"           => sub { push @using,  $_[1]; },
      'bargraph'          => \$bar_graph,
      'dump-to-screen'    => \$dump_to_screen,
      'gnuplot-command=s' => \$gnuplot_command,
      'lines'             => \$lines,
      $this->site_args(),
   };

   $this->parse_options($args, $spec);

   die 'Must specify at least one field' unless ( $key_groups->has_any_group() );

   if ( $bar_graph && $lines ) {
      die 'Must specify one of --bargraph or --lines';
   }

   $png_file .= '.png' unless ( $png_file =~ m/\.png$/ );

   if ( ! $dump_to_screen ) {
      if ( open(my $fh, '|-', $gnuplot_command) ) {
         close $fh;
      }
      else {
         warn "Could not run gnuplot command: $gnuplot_command: $!\n";
         warn "May want to specify a binary with --gnuplot-command\n";
         exit 0;
      }
   }

   my ($tempfh, $tempfile) = tempfile();

   $this->{'BAR_GRAPH'}       = $bar_graph;
   $this->{'DUMP_TO_SCREEN'}  = $dump_to_screen;
   $this->{'FIRST_RECORD'}    = 1;
   $this->{'GNUPLOT_COMMAND'} = $gnuplot_command;
   $this->{'KEY_GROUPS'}      = $key_groups;
   $this->{'LABELS'}          = \@labels;
   $this->{'LINES'}           = $lines;
   $this->{'PLOTS'}           = \@plots;
   $this->{'PNG_FILE'}        = $png_file;
   $this->{'PRECOMMANDS'}     = \@precommands;
   $this->{'TEMPFH'}          = $tempfh;
   $this->{'TEMPFILE'}        = $tempfile;
   $this->{'TITLE'}           = $title;
   $this->{'USING'}           = \@using;
}

sub init_fields {
   my $this   = shift;
   my $record = shift;

   my $specs     = $this->{'KEY_GROUPS'}->get_keyspecs($record);
   my $using     = $this->{'USING'};
   my $bar_graph = $this->{'BAR_GRAPH'};
   my $lines     = $this->{'LINES'};
   my $title     = $this->{'TITLE'};

   if ( ! $bar_graph && !$lines ) {
      die 'Must specify using if more than 2 fields' if ( scalar @$specs > 2 ) && (! scalar @$using > 0);
   }

   if ( ! $title ) {
      $title = join(', ', @$specs);
   }

   if ( scalar @$using == 0 ) {
      if ( $bar_graph || $lines ) {
         my $using_spec = "1 title \"$specs->[0]\"";

         foreach my $idx (2..@$specs) {
            my $title = $specs->[$idx-1];
            $using_spec .= ", '' using $idx title \"$title\"";
         }

         push @$using, $using_spec;
      }
      elsif ( scalar @$specs == 1 ) {
         push @$using, "1";
      }
      elsif ( scalar @$specs == 2 ) {
         push @$using, "1:2";
      }
   }

   $this->{'FIELDS'} = $specs;
   $this->{'TITLE'}  = $title;
}

# hook for additional args
sub site_args {
}

sub accept_record {
   my ($this, $record) = @_;

   if ( $this->{'FIRST_RECORD'} ) {
      $this->{'FIRST_RECORD'} = 0;
      $this->init_fields($record);
   }

   my $line = '';
   foreach my $key (@{$this->{'FIELDS'}}) {
      my $value = ${$record->guess_key_from_spec($key)};
      $line .= "$value ";
   }

   chop $line;
   if ( $this->{'DUMP_TO_SCREEN'} ) {
      $this->print_value($line . "\n");
   }
   else {
      my $tempfh = $this->{'TEMPFH'};
      print $tempfh $line . "\n";
   }
}

sub stream_done {
   my ($this) = @_;

   close $this->{'TEMPFH'};

   my $plot_script = '';
   $plot_script .= "set terminal png\n";
   $plot_script .= "set output '" . $this->{'PNG_FILE'} . "'\n";
   $plot_script .= "set title '" . $this->{'TITLE'} . "'\n";

   if ( $this->{'BAR_GRAPH'} ) {
      $plot_script .= <<CMDS;
set style data histogram
set style histogram cluster gap 1
set style fill solid border -1
CMDS
   }
   elsif ( $this->{'LINES'} ) {
      $plot_script .= "set style data linespoints\n";
   }

   foreach my $command (@{$this->{'PRECOMMANDS'}}) {
      $plot_script .= $command . "\n";
   }

   my $plot_cmd = 'plot ';

   my $index = 0;
   my $default_label = join(', ', @{$this->{'FIELDS'}});

   foreach my $use_spec (@{$this->{'USING'}}) {
      if ( $this->{'DUMP_TO_SCREEN'} ) {
         $plot_cmd .= "'screen' using $use_spec ";
      }
      else {
         $plot_cmd .= "'" . $this->{'TEMPFILE'} . "' using $use_spec ";
      }

      if ( not ($use_spec =~ m/title/) ) {
         my $label = $default_label;

         if ( $this->{'LABELS'}->[$index] ) {
            $label = $this->{'LABELS'}->[$index];
         }

         $plot_cmd .= "title '$label'";
      }

      $plot_cmd .= ', ';
      $index++;
   }

   chop $plot_cmd;
   chop $plot_cmd;

   if ( @{$this->{'PLOTS'}} ) {
      $plot_cmd .= ', ' . join(', ', @{$this->{'PLOTS'}});
   }

   $plot_script .= $plot_cmd;

   if ( $this->{'DUMP_TO_SCREEN'} ) {
      $this->print_value($plot_script . "\n");
   }
   else {
      open(my $plot, '|-', $this->{'GNUPLOT_COMMAND'});
      print $plot $plot_script;
      close $plot;
   }

   if ( $? ) {
      warn "Gnuplot failed, bailing!\n";
      $this->_set_exit_value($?);
      return;
   }

   $this->print_value("Wrote graph file: " . $this->{'PNG_FILE'} . "\n");
}

sub DESTROY {
   my ($this) = @_;

   if ( $this->{'TEMPFH'} ) {
      close $this->{'TEMPFH'};
   }

   if ( $this->{'TEMPFILE'} ) {
      unlink $this->{'TEMPFILE'};
   }
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
   $this->use_help_type('keygroups');
   $this->use_help_type('keys');
}

sub usage {
   return <<USAGE;
Usage: recs-tognuplot <args> [<files>]
   Create a graph of points from a record stream using GNU Plot. Defaults to
   creatinga scatterplot of points, can also create a bar or line graph

   For the --using and --plot arguments, you may want to reference a GNU Plot
   tutorial, though it can get quite complex, here is one example:

   http://www.gnuplot.info/docs/node100.html

Arguments:
   --key|-k <keys>                May be specified multiple times, may be
                                  comma separated.  These are the keys to graph.  If you
                                  have more than 2 keys, you must specify a --using
                                  statement or use --bargraph or --lines
                                  May be a keyspec or keygroup, see
                                  '--help-keys' for more information
   --using <using spec>           A 'using' string passed directly to gnuplot,
                                  you can use keys specified with --key in the order
                                  specified.  For instance --key count,date,avg with
                                  --using '3:2' would plot avg vs. date.  May be
                                  specified multiple times
   --plot <plot spec>             May be specified multiple times, may be comma separated.
                                  A directive passed directly to plot,
                                  e.g. --plot '5 title "threshold"'
   --precommand <gnuplot spec>    May be specified multiple times, may be comma separated.
                                  A command executed by gnuplot before executing plot,
                                  e.g. --precommand 'set xlabel "foo"'
   --title <title>                Specify a title for the entire graph
   --label <label>                Labels each --using line with the indicated label
   --file <filename>              Name of output png file.  Will append .png if not
                                  present Defaults to tognuplot.png
   --lines                        Draw lines between points, may specify more
                                  than 2 key, each field is a line
   --bargraph                     Draw a bar graph, each field is a bar, may specify
                                  than 2 key, each field is a bar
   --gnuplot-command              Location of gnuplot binary if not on path

   Graph the count field
      recs-tognuplot --field count
   Graph count vs. date with a threshold line
      recs-tognuplot --field count,date --plot "5 title 'threshold'"
   Graph a complicated expression, with a label
      recs-tognuplot --field count,date,adjust --using '(\$1-\$3):2' --label "counts"
   Graph count vs. date, with a title
      recs-tognuplot --field count,date --title 'counts over time'
   Graph count1, count2, count3 as 3 different bars in a bar graph
      recs-tognuplot --field count1,count2,count3
USAGE
}

1;
