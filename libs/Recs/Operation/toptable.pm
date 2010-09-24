package Recs::Operation::toptable;

use strict;
use warnings;

use base qw(Recs::Accumulator Recs::Operation Recs::ScreenPrinter);

use Recs::OutputStream;

# TODO: zOMG!  This format is so ugly it hurts.  Think of something better.

sub init {
   my $this = shift;
   my $args = shift;

   my @xfields;
   my @yfields;
   my %pins;
   my @vfields;
   my $headers = 1;
   my $full = 0;

   my $spec = {
      "x-field|x=s"     => sub { push @xfields, split(/,/, $_[1]); },
      "y-field|y=s"     => sub { push @yfields, split(/,/, $_[1]); },
      "v-field|v=s"     => sub { push @vfields, split(/,/, $_[1]); },
      "pin=s"           => sub { for(split(/,/, $_[1])) { if(/^(.*)=(.*)$/) { $pins{$1} = $2; } } },
      'noheaders'       => sub { $headers = 0; },
      'full'            => \$full,
   };

   $this->parse_options($args, $spec);

   my %xfields = map { $_ => 1 } @xfields;
   my %yfields = map { $_ => 1 } @yfields;
   my %vfields;
   my $do_vfields = scalar(@vfields) ? 0 : 1;


   $this->{'XFIELDS_ARRAY'} = \@xfields;
   $this->{'YFIELDS_ARRAY'} = \@yfields;
   $this->{'PINS_HASH'}     = \%pins;
   $this->{'VFIELDS_ARRAY'} = \@vfields;
   $this->{'HEADERS'}       = $headers;
   $this->{'XFIELDS_HASH'}  = \%xfields;
   $this->{'YFIELDS_HASH'}  = \%yfields;
   $this->{'VFIELDS_HASH'}  = \%vfields;
   $this->{'DO_VFIELDS'}    = $do_vfields;
   $this->{'FULL'}          = $full;
}

sub stream_done {
   my $this = shift;

   my @xfields    = @{$this->{'XFIELDS_ARRAY'}};
   my @yfields    = @{$this->{'YFIELDS_ARRAY'}};
   my %pins       = %{$this->{'PINS_HASH'}};
   my @vfields    = @{$this->{'VFIELDS_ARRAY'}};
   my $headers    = $this->{'HEADERS'};
   my %xfields    = %{$this->{'XFIELDS_HASH'}};
   my %yfields    = %{$this->{'YFIELDS_HASH'}};
   my %vfields    = %{$this->{'VFIELDS_HASH'}};
   my $do_vfields = $this->{'DO_VFIELDS'};

   # TODO: fix this for key specs (nested keys)
   # change the record no vivify option to throw an exception
   # change recs-delta to handle that
   # invert this inner loop so you go looking for each key as it comes up...
   my $records = $this->get_records();
   my @r = @$records;
   for my $r (@r) {
      if($do_vfields) {
         for my $field (keys(%$r)) {
            if(!exists($xfields{$field}) && !exists($yfields{$field}) && !exists($pins{$field}) && !exists($vfields{$field})) {
               push @vfields, $field;
               $vfields{$field} = 1;
            }
         }
      }
   }

   # pass 1: build xvals and yvals structures and break records up by vfield

   my @r2;
   my %xvs;
   my %yvs;
   for my $r (@r) {
      # make sure records matches appropriate pins
      my $ko = 0;
      for my $pfield (keys(%pins)) {
         if($pfield eq "FIELD") {
            next;
         }

         my $v = "";
         if(exists($r->{$pfield})) {
            $v = $r->{$pfield};
         }
         if($pins{$pfield} ne $v) {
            $ko = 1;
            last;
         }
      }
      if($ko) {
         next;
      }

      for my $vfield (@vfields) {
         # nothing to see here
         if(!exists($r->{$vfield})) {
            next;
         }

         # if field is pinned, skip other vfields
         if(exists($pins{"FIELD"}) && $pins{"FIELD"} ne $vfield) {
            next;
         }

         my @xv;
         for my $xfield (@xfields) {
            my $v = "";
            if($xfield eq "FIELD") {
               $v = $vfield;
            }
            elsif(exists($r->{$xfield})) {
               $v = $r->{$xfield}
            }
            push @xv, $v;
         }

         my @yv;
         for my $yfield (@yfields) {
            my $v = "";
            if($yfield eq "FIELD") {
               $v = $vfield;
            }
            elsif(exists($r->{$yfield})) {
               $v = $r->{$yfield}
            }
            push @yv, $v;
         }

         my $v = "";
         if(exists($r->{$vfield})) {
            $v = $r->{$vfield};
         }

         _put_deep(\%xvs, @xv);
         _put_deep(\%yvs, @yv);

         push @r2, [\@xv, \@yv, $v];
      }
   }

   my @xvs;
   _dump_deep(\%xvs, \@xvs, scalar(@xfields));
   my @yvs;
   _dump_deep(\%yvs, \@yvs, scalar(@yfields));

   my $width_offset  = scalar @yfields;
   my $height_offset = scalar @xfields;

   if ( $headers ) {
      $width_offset  += 1;
      $height_offset += 1;
   }

   my $w = $width_offset + scalar(@xvs);
   my $h = $height_offset + scalar(@yvs);
   my @table = map { [map { "" } (1..$w)] } (1..$h);

   if ( $headers ) {
      for(my $i = 0; $i < @xfields; ++$i) {
         $table[$i]->[scalar(@yfields)] = $xfields[$i];
      }

      for(my $i = 0; $i < @yfields; ++$i) {
         $table[scalar(@xfields)]->[$i] = $yfields[$i];
      }
   }

   my @last_xv = map { "" } (1..@xfields);
   for(my $i = 0; $i < @xvs; ++$i) {
      my $xv = $xvs[$i];
      for(my $j = 0; $j < @xfields; ++$j) {
         if($last_xv[$j] ne $xv->[$j]) {
            $last_xv[$j] = $xv->[$j];
            $table[$j]->[$width_offset + $i] = $xv->[$j];
            for(my $k = $j + 1; $k < @xfields; ++$k) {
               $last_xv[$k] = "";
            }
         }
      }
   }

   my @last_yv = map { "" } (1..@yfields);
   for(my $i = 0; $i < @yvs; ++$i) {
      my $yv = $yvs[$i];
      for(my $j = 0; $j < @yfields; ++$j) {
         if($last_yv[$j] ne $yv->[$j]) {
            $last_yv[$j] = $yv->[$j];
            $table[$height_offset + $i]->[$j] = $yv->[$j];
            for(my $k = $j + 1; $k < @yfields; ++$k) {
               $last_yv[$k] = "";
            }
         }
      }
   }

   for my $r2 (@r2) {
      my ($xv, $yv, $v) = @$r2;

      my $i = _find_deep(\%xvs, @$xv);

      if($i == -1) {
         die "No index set for " . join(", " . @$xv);
      }

      my $j = _find_deep(\%yvs, @$yv);

      if($j == -1) {
         die "No index set for " . join(", " . @$yv);
      }

      $table[$height_offset + $j]->[$width_offset + $i] = $v;
   }

   my @w;

   for my $row (@table) {
      while(@w < @$row) {
         push @w, 0;
      }
      for(my $i = 0; $i < @$row; ++$i) {
         my $l = length($row->[$i]);

         if($l > $w[$i]) {
            $w[$i] = $l;
         }
      }
   }

   for my $row (@table) {
      $this->print_value(_format_row(\@w, sub { return ("-" x $_[1]); }, "+") . "\n");
      $this->print_value(_format_row(\@w, sub { if($_[0] < @$row) { return $row->[$_[0]]; } return ""; }, "|") . "\n");
   }
   $this->print_value(_format_row(\@w, sub { return ("-" x $_[1]); }, "+") . "\n");
}

sub _format_row {
   my ($w, $pfn, $delim) = @_;

   my $s = $delim;
   for(my $i = 0; $i < @$w; ++$i) {
      my $c = $pfn->($i, $w->[$i]);

      $c .= " " x ($w->[$i] - length($c));

      $s .= $c . $delim;
   }

   return $s;
}

sub _put_deep {
    my $hr = shift;

    while(@_) {
        my $k = shift;

        if(!exists($hr->{$k})) {
            $hr->{$k} = { };
        }

        $hr = $hr->{$k};
    }

    $hr->{"_"} = -1;
}

sub _dump_deep {
    my ($hr, $ar, $depth, @xv) = @_;

    if(!$depth) {
        $hr->{"_"} = scalar(@$ar);
        push @$ar, \@xv;
        return;
    }

    for my $k (sort(keys(%$hr))) {
        _dump_deep($hr->{$k}, $ar, $depth - 1, @xv, $k);
    }
}

sub _find_deep {
    my $hr = shift;

    while(@_) {
        my $k = shift;

        $hr = $hr->{$k};

        if(!$hr) {
            die "Missing key " . $k . " followed by " . join(", ", @_);
        }
    }

    return $hr->{"_"};
}

sub usage {
   my $this = shift;

   if(ref $this && $this->{'FULL'}) {
      return <<FULL_HELP
Full Help

Lets first take a look at some examples:

Lets take this stream, which is a portion of my recs-fromps:
\$ recs-fromps --fields rss,pid,state,priority | recs-topn --key state -n 5 | tee /var/tmp/psrecs
{"priority":0,"pid":1,"rss":471040,"state":"sleep"}
{"priority":0,"pid":2,"rss":0,"state":"sleep"}
{"priority":0,"pid":3,"rss":0,"state":"sleep"}
{"priority":0,"pid":4,"rss":0,"state":"sleep"}
{"priority":19,"pid":5,"rss":0,"state":"sleep"}
{"priority":19,"pid":2094,"rss":8351744,"state":"run"}
{"priority":0,"pid":28129,"rss":4784128,"state":"run"}
{"priority":19,"pid":28171,"rss":405504,"state":"run"}

Ok, Now lets get a table out of this, first we'll collate into some useful information:
\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count 
{"priority":0,"count":4,"state":"sleep"}
{"priority":19,"count":1,"state":"sleep"}
{"priority":0,"count":1,"state":"run"}
{"priority":19,"count":2,"state":"run"}

And lets get a table:
\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count | recs-toptable --x priority --y state
+-----+--------+-+--+
|     |priority|0|19|
+-----+--------+-+--+
|state|        | |  |
+-----+--------+-+--+
|run  |        |1|2 |
+-----+--------+-+--+
|sleep|        |4|1 |
+-----+--------+-+--+

So, you can see that the VALUES of priority and state are used as the columns /
rows.  So that there is 1 process in state 'run' and priority 0, and 4 in state
'sleep' and priority 0

The --cube option on recs-collate also interacts very well with toptable:

\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count --cube | recs-toptable --x priority --y state 
+-----+--------+-+--+---+
|     |priority|0|19|ALL|
+-----+--------+-+--+---+
|state|        | |  |   |
+-----+--------+-+--+---+
|ALL  |        |5|3 |8  |
+-----+--------+-+--+---+
|run  |        |1|2 |3  |
+-----+--------+-+--+---+
|sleep|        |4|1 |5  |
+-----+--------+-+--+---+

We added an ALL row and an ALL column.  So from this you can see that there are
5 processes in priority 0, 3 processes in state 'run' and 8 processes all told
in the table (the ALL, ALL intersection)

Now lets see what happens when we have more than 1 left over field.  Lets also
sum up the rss usage of the processes with -a sum,rss on recs-collate:

\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count --cube -a sum,rss 
{"priority":0,"count":4,"state":"sleep","sum_rss":471040}
{"priority":"ALL","count":5,"state":"sleep","sum_rss":471040}
{"priority":19,"count":1,"state":"sleep","sum_rss":0}
{"priority":0,"count":5,"state":"ALL","sum_rss":5255168}
{"priority":0,"count":1,"state":"run","sum_rss":4784128}
{"priority":"ALL","count":8,"state":"ALL","sum_rss":14012416}
{"priority":"ALL","count":3,"state":"run","sum_rss":13541376}
{"priority":19,"count":3,"state":"ALL","sum_rss":8757248}
{"priority":19,"count":2,"state":"run","sum_rss":8757248}

So now we have 2 left over fields that aren't columns, count and sum_rss.  What
happens to our table now:

\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count --cube -a sum,rss | recs-toptable --x priority --y state
+-----+--------+-------+-------+--------+
|     |priority|0      |19     |ALL     |
+-----+--------+-------+-------+--------+
|state|        |       |       |        |
+-----+--------+-------+-------+--------+
|ALL  |        |5255168|8757248|14012416|
+-----+--------+-------+-------+--------+
|run  |        |4784128|8757248|13541376|
+-----+--------+-------+-------+--------+
|sleep|        |471040 |0      |471040  |
+-----+--------+-------+-------+--------+

We now have sum_rss values in this field.  What if we want the other field
(count) displayed?  We just use --value-field to specify what value field to
use:

\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count --cube -a sum,rss | recs-toptable --x priority --y state --v count
+-----+--------+-+--+---+
|     |priority|0|19|ALL|
+-----+--------+-+--+---+
|state|        | |  |   |
+-----+--------+-+--+---+
|ALL  |        |5|3 |8  |
+-----+--------+-+--+---+
|run  |        |1|2 |3  |
+-----+--------+-+--+---+
|sleep|        |4|1 |5  |
+-----+--------+-+--+---+

Ok, but what if we want to see both left over fields at the same time?  What we
really want is to add a column or row for each of count and sum_rss.  (where
the title of the row is count or sum_rss, not the values of the field).  We can
do this by using the special FIELD specifier like so:

\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count --cube -a sum,rss | recs-toptable --x priority,FIELD --y state
+-----+--------+-----+-------+-----+-------+-----+--------+
|     |priority|0    |       |19   |       |ALL  |        |
+-----+--------+-----+-------+-----+-------+-----+--------+
|     |FIELD   |count|sum_rss|count|sum_rss|count|sum_rss |
+-----+--------+-----+-------+-----+-------+-----+--------+
|state|        |     |       |     |       |     |        |
+-----+--------+-----+-------+-----+-------+-----+--------+
|ALL  |        |5    |5255168|3    |8757248|8    |14012416|
+-----+--------+-----+-------+-----+-------+-----+--------+
|run  |        |1    |4784128|2    |8757248|3    |13541376|
+-----+--------+-----+-------+-----+-------+-----+--------+
|sleep|        |4    |471040 |1    |0      |5    |471040  |
+-----+--------+-----+-------+-----+-------+-----+--------+

So, now in one table we can see all the intersections of state and priority
values with the count and sum_rss fields.  Remember that the ALL field (row and
column) are provided by the --cube functionality of recs-collate

Now, say you want to pin value, lets just look at processes in state run for
instance:

\$ cat /var/tmp/psrecs | recs-collate --perfect --cube --key priority,state -a count -a sum,rss | recs-toptable --x priority,FIELD --y state -v sum_rss,count --pin state=run 
+-----+--------+-----+-------+-----+-------+-----+--------+
|     |priority|0    |       |19   |       |ALL  |        |
+-----+--------+-----+-------+-----+-------+-----+--------+
|     |FIELD   |count|sum_rss|count|sum_rss|count|sum_rss |
+-----+--------+-----+-------+-----+-------+-----+--------+
|state|        |     |       |     |       |     |        |
+-----+--------+-----+-------+-----+-------+-----+--------+
|run  |        |1    |4784128|2    |8757248|3    |13541376|
+-----+--------+-----+-------+-----+-------+-----+--------+

As you can see, this is basically short hand for doing a recs-grep, the transformation to recs group would look like:

\$ cat /var/tmp/psrecs | recs-collate --perfect --cube --key priority,state -a count -a sum,rss | recs-grep '\$r->{state} eq "run"' | recs-toptable --x priority,FIELD --y state -v sum_rss,count

(which produces the same table as above).
FULL_HELP
   }
   return <<USAGE;
Usage: recs-toptable <args> [<files>]
   Creates a multi-dimensional pivot table with any number of x and y axises.
   There is additional help available through --full that includes examples

   The x and y rows and columns are the values of the field specified

   X and Y fields can take the special value 'FIELD' which uses unused field
   names as values for the FIELD dimension

   NOTE: This script does not support key specs (nested or guessed keys), all
   field arguments must be first level actual keys

   --help       Bail and print this usage
   --x-field|x  Add a x field, values of the specified field will become
                columns in the table
   --y-field|y  Add a y field, values of the specified field will become
                rows in the table
   --v-field|v  Specify the value to display in the table, if multiple value
                fields are specified and FIELD is not placed in the x or y
                axes, then the last one wins
   --pin        Pin a field to a certain value, only display records matching
                that value, very similar to doing a recs-grep befor toptable.
                Takes value of the form: field=pinnedValue
   --full       Print full help documentation, including example and bail
   --noheaders  Do not print row and column headers (removes blank rows and
                columns)

Simple Examples (see --full for more detailed descriptions)

  # Collate and display in a nice table
  ... | recs-collate --key state,priority -a count | recs-toptable --x state --y priority

  # Display left over field names as columns
  ... | recs-collate --key state,priority -a count -a sum,rss | recs-toptable --x state,FIELD --y priority

  # Specify the displayed cell values
  ... | recs-collate --key state,priority -a count -a sum,rss | recs-toptable --x state,FIELD --y priority --value sum_rss
USAGE
}

1;
