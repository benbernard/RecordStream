package Recs::Operation::tognuplot;

use strict;
use warnings;

use base qw(Recs::Operation Recs::ScreenPrinter);

use File::Temp qw(tempfile);

sub init {
   my $this = shift;
   my $args = shift;

   my $png_file = 'tognuplot.png';
   my $title;
   my @fields;
   my @labels;
   my @plots;
   my @precommands;
   my @using;
   my $bar_graph;
   my $lines;

   my $spec = {
      "fields|f=s"       => sub { push @fields, split(/,/, $_[1]); },
      "file=s"           => \$png_file,
      "label=s"          => sub { push @labels, split(/,/, $_[1]); },
      "plot=s"           => sub { push @plots, split(/,/, $_[1]); },
      "title=s"          => \$title,
      "using=s"          => sub { push @using,  $_[1]; },
      "precommand=s"     => sub { push @precommands, split(/,/, $_[1]); },
      'bargraph'         => \$bar_graph,
      'lines'            => \$lines,
      $this->site_args(),
   };

   $this->parse_options($args, $spec);

   die 'Must specify at least one field' unless ( scalar @fields > 0 );

   if ( ! $bar_graph && !$lines ) {
      die 'Must specify using if more than 2 fields' if ( scalar @fields > 2 ) && (! scalar @using > 0);
   }

   if ( $bar_graph && $lines ) {
      die 'Must specify one of --bargraph or --lines';
   }

   if ( ! $title ) {
      $title = join(', ', @fields);
   }

   if ( scalar @using == 0 ) {
      if ( $bar_graph || $lines ) {
         my $using = "1 title \"$fields[0]\"";

         foreach my $idx (2..@fields) {
            my $title = $fields[$idx-1];
            $using .= ", '' using $idx title \"$title\"";
         }

         push @using, $using;
      }
      elsif ( scalar @fields == 1 ) {
         push @using, "1";
      }
      elsif ( scalar @fields == 2 ) {
         push @using, "1:2";
      }
   }

   $png_file .= '.png' unless ( $png_file =~ m/\.png$/ );

   my ($tempfh, $tempfile) = tempfile();

   $this->{'TEMPFILE'}    = $tempfile;
   $this->{'FIELDS'}      = \@fields;
   $this->{'TEMPFH'}      = $tempfh;
   $this->{'PNG_FILE'}    = $png_file;
   $this->{'TITLE'}       = $title;
   $this->{'BAR_GRAPH'}   = $bar_graph;
   $this->{'LINES'}       = $lines;
   $this->{'PRECOMMANDS'} = \@precommands;
   $this->{'USING'}       = \@using;
   $this->{'LABELS'}      = \@labels;
   $this->{'PLOTS'}       = \@plots;
}

sub accept_record {
   my ($this, $record) = @_;

   my $line = '';
   foreach my $key (@{$this->{'FIELDS'}}) {
      my $value = ${$record->guess_key_from_spec($key)};
      $line .= "$value ";
   }

   chop $line;
   my $tempfh = $this->{'TEMPFH'};
   print $tempfh $line . "\n";
}

sub stream_done {
   my ($this) = @_;

   close $this->{'TEMPFH'};

   open(my $plot, '|-', 'gnuplot');
   print $plot "set terminal png\n";
   print $plot "set output '" . $this->{'PNG_FILE'} . "'\n";
   print $plot "set title '" . $this->{'TITLE'} . "'\n";

   if ( $this->{'BAR_GRAPH'} ) {
      print $plot <<CMDS;
set style data histogram
set style histogram cluster gap 1
set style fill solid border -1
CMDS
   }
   elsif ( $this->{'LINES'} ) {
      print $plot "set style data linespoints\n";
   }

   foreach my $command (@{$this->{'PRECOMMANDS'}}) {
      print $plot $command . "\n";
   }

   my $plot_cmd = 'plot ';

   my $index = 0;
   my $default_label = join(', ', @{$this->{'FIELDS'}});

   foreach my $use_spec (@{$this->{'USING'}}) {
      $plot_cmd .= "'" . $this->{'TEMPFILE'} . "' using $use_spec ";

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

   print $plot $plot_cmd;
   close $plot;

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

sub usage {
   return <<USAGE;
Usage: recs-tognuplot <args> [<files>]
   Create a graph of points from a record stream using GNU Plot. Defaults to
   creatinga scatterplot of points, can also create a bar or line graph

   For the --using and --plot fields, you may want to reference a GNU Plot
   tutorial, though it can get quite complex, here is one example:

   http://www.gnuplot.info/docs/node100.html

Arguments:
   --fields|-f <fields>           May be specified multiple times, may be
                                  comma separated.  These are the keys to graph.  If you
                                  have more than 2 keys, you must specify a --using
                                  statement or use --bargraph or --lines
                                  May be a key spec, see 'man recs' for more
   --using <using spec>           A 'using' string passed directly to gnuplot,
                                  you can use fields specified with --fields in the order
                                  specified.  For instance --fields count,date,avg with
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
                                  than 2 fields, each field is a line
   --bargraph                     Draw a bar graph, each field is a bar, may specify
                                  than 2 fields, each field is a bar
   --help                         Bail and output this help screen.

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
