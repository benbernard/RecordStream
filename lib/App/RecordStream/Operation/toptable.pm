package App::RecordStream::Operation::toptable;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Accumulator App::RecordStream::Operation);

use App::RecordStream::Record;

# TODO: amling, this format is so ugly it hurts.  Think of something better.

sub init {
   my $this = shift;
   my $args = shift;

   my %pins;
   my $headers = 1;
   my $full = 0;

   my $xgroup = App::RecordStream::KeyGroups->new();
   my $ygroup = App::RecordStream::KeyGroups->new();
   my $vgroup = App::RecordStream::KeyGroups->new();
   my $output_records = 0;
   my %sorts = ();

   my $spec = {
      "x-field|x=s"     => sub { $xgroup->add_groups($_[1]); },
      "y-field|y=s"     => sub { $ygroup->add_groups($_[1]); },
      "v-field|v=s"     => sub { $vgroup->add_groups($_[1]); },
      "pin=s"           => sub { for(split(/,/, $_[1])) { if(/^(.*)=(.*)$/) { $pins{$1} = $2; } } },
      "sort=s"          => sub { for(split(/,/, $_[1])) { my ($comparator, $field) = App::RecordStream::Record::get_comparator_and_field($_); $sorts{$field} = $comparator; } },
      'noheaders'       => sub { $headers = 0; },
      'records|recs'    => \$output_records,
   };

   $this->parse_options($args, $spec);

   my $do_vfields = !$vgroup->has_any_group();

   $this->{'XGROUP'} = $xgroup;
   $this->{'YGROUP'} = $ygroup;
   $this->{'VGROUP'} = $vgroup;

   $this->{'PINS_HASH'}      = \%pins;
   $this->{'SORTS'}          = \%sorts;
   $this->{'HEADERS'}        = $headers;
   $this->{'DO_VFIELDS'}     = $do_vfields;
   $this->{'OUTPUT_RECORDS'} = $output_records;
}

sub stream_done {
   my $this = shift;

   my %pins       = %{$this->{'PINS_HASH'}};
   my $headers    = $this->{'HEADERS'};
   my $do_vfields = $this->{'DO_VFIELDS'};

   my $xgroup     = $this->{'XGROUP'};
   my $ygroup     = $this->{'YGROUP'};
   my $vgroup     = $this->{'VGROUP'};

   my $xfields_hash = {};
   my $yfields_hash = {};
   my $vfields_hash = {};

   my $records = $this->get_records();

   my (@xfields, @yfields, @vfields);
   # Prep x and y fields
   foreach my $record (@$records) {
      foreach my $spec ( @{$xgroup->get_keyspecs_for_record($record)} ) {
         if ( !$xfields_hash->{$spec} ) {
            $xfields_hash->{$spec} = 1;
            push @xfields, $spec;
         }
      }
      foreach my $spec ( @{$ygroup->get_keyspecs_for_record($record)} ) {
         if ( !$yfields_hash->{$spec} ) {
            $yfields_hash->{$spec} = 1;
            push @yfields, $spec;
         }
      }
   }

   # Prep v fields
   if($do_vfields) {
      my %vfields;
      my %used_first_level_keys;

      for my $record (@$records) {
         foreach my $spec (@xfields, @yfields, keys %pins) {
            my $key_list = $record->get_key_list_for_spec($spec);
            if (scalar @$key_list > 0) {
               $used_first_level_keys{$key_list->[0]} = 1;
            }
         }

         foreach my $field (keys(%$record)) {
            if ( !exists($used_first_level_keys{$field}) && 
                 !exists($vfields{$field}) ) {
               push @vfields, $field;
               $vfields{$field} = 1;
            }
         }
      }
   }
   else {
      my $vfields_hash = {};
      foreach my $record (@$records) {
         foreach my $spec ( @{$vgroup->get_keyspecs_for_record($record)} ) {
            if ( !$vfields_hash->{$spec} ) {
               $vfields_hash->{$spec} = 1;
               push @vfields, $spec;
            }
         }
      }
   }

   # pass 1: build xvals and yvals structures and break records up by vfield

   my @r2;
   # x_values_tree represent a nested tree of all possible x value tuples
   # i.e.  {x2 => 4, y => 7, x1 => 1} has an x values tuple of (1, 4) and thus with "touch" that path in the tree
   my $x_values_tree = _new_node();
   my $y_values_tree = _new_node();
   foreach my $record (@$records) {
      # make sure records matches appropriate pins
      my $kickout = 0;
      foreach my $pfield (keys(%pins)) {
         if($pfield eq "FIELD") {
            next;
         }

         my $v = '';

         if ( $record->has_key_spec($pfield) ) {
            $v = ${$record->guess_key_from_spec($pfield)};
         }

         if($pins{$pfield} ne $v) {
            $kickout = 1;
            last;
         }
      }
      if($kickout) {
         next;
      }

      for my $vfield (@vfields) {
         # nothing to see here
         if(!$record->has_key_spec($vfield)) {
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
            elsif($record->has_key_spec($xfield)) {
               $v = ${$record->guess_key_from_spec($xfield)};
            }
            push @xv, $v;
         }

         my @yv;
         for my $yfield (@yfields) {
            my $v = "";
            if($yfield eq "FIELD") {
               $v = $vfield;
            }
            elsif($record->has_key_spec($yfield)) {
               $v = ${$record->guess_key_from_spec($yfield)};
            }
            push @yv, $v;
         }

         my $v = "";
         if($record->has_key_spec($vfield)) {
            $v = ${$record->guess_key_from_spec($vfield)};
         }

         _touch_node_recurse($x_values_tree, @xv);
         _touch_node_recurse($y_values_tree, @yv);

         push @r2, [\@xv, \@yv, $v];
      }
   }

   # Start constructing the ASCII table

   # we dump the tree out into all possible x value tuples (saved in
   # @x_value_list) and tag each node in the tree with the index in
   # @x_values_list so we can look it up later
   my @x_values_list;
   $this->_dump_node_recurse($x_values_tree, \@x_values_list, [@xfields], []);

   my @y_values_list;
   $this->_dump_node_recurse($y_values_tree, \@y_values_list, [@yfields], []);

   # Collected the data, if we're only outputing records, stop here.
   if ( $this->{'OUTPUT_RECORDS'} ) {
      $this->output_records(\@xfields, \@yfields, \@r2, \@x_values_list, \@y_values_list);
      return;
   }


   my $width_offset  = scalar @yfields;
   my $height_offset = scalar @xfields;

   if ( $headers ) {
      $width_offset  += 1;
      $height_offset += 1;
   }

   my $w = $width_offset + scalar(@x_values_list);
   my $h = $height_offset + scalar(@y_values_list);
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
   for(my $i = 0; $i < @x_values_list; ++$i) {
      my $xv = $x_values_list[$i];
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
   for(my $i = 0; $i < @y_values_list; ++$i) {
      my $yv = $y_values_list[$i];
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

      # now we have our x value tuple, we need to know where it was in @x_values_list so we can know its x coordinate
      my $i = _find_index_recursive($x_values_tree, @$xv);

      if($i == -1) {
         die "No index set for " . join(", " . @$xv);
      }

      my $j = _find_index_recursive($y_values_tree, @$yv);

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
      $this->push_line(_format_row(\@w, sub { return ("-" x $_[1]); }, "+"));
      $this->push_line(_format_row(\@w, sub { if($_[0] < @$row) { return $row->[$_[0]]; } return ""; }, "|"));
   }
   $this->push_line(_format_row(\@w, sub { return ("-" x $_[1]); }, "+"));
}

sub output_records {
   my ($this, $xfields, $yfields, $values, $ordered_x_values, $ordered_y_values) = @_;

   my $records = {};

   #fill in hashes
   foreach my $y_values (@$ordered_y_values) {
      my $key = join('-', @$y_values);

      # Fill in empties
      foreach my $x_values (@$ordered_x_values) {

         my $hash = $records->{$key} ||= {};
         my $last_hash = $hash;
         my $last_x_value;

         my $index = -1;
         foreach my $x_value (@$x_values) {
            $index++;
            my $x_name = $xfields->[$index];
            $hash->{$x_name}->{$x_value}  ||= {};
            $last_hash = $hash->{$x_name};
            $last_x_value = $x_value;
            $hash =  $hash->{$x_name}->{$x_value};
         }
         $last_hash->{$last_x_value} = '';
      }
   }

   foreach my $vector (@$values) {
      my ($xvalues, $yvalues, $value) = @$vector;
      my $record_key = join('-', @$yvalues);
      my $record_hash = ($records->{$record_key} ||= {});

      my $index = -1;
      foreach my $yfield (@$yfields) {
         $index++;
         $record_hash->{$yfield} = $yvalues->[$index];
      }

      my $data = $record_hash;
      $index = -1;
      my $last_hash;
      my $last_xvalue;
      foreach my $xfield (@$xfields) {
         $index++;
         my $xvalue = $xvalues->[$index];

         $data->{$xfield}->{$xvalue} ||= {};
         $last_hash = $data->{$xfield};
         $last_xvalue = $xvalue;

         $data = $data->{$xfield}->{$xvalue};
      }

      $last_hash->{$last_xvalue} = $value;
   }

   foreach my $y_values (@$ordered_y_values) {
      my $key = join('-', @$y_values);
      $this->push_record(App::RecordStream::Record->new($records->{$key}));
   }
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

sub _get_sort {
   my $this = shift;
   my $field = shift;

   my $comparator = $this->{'SORTS'}->{$field};
   if(!defined($comparator)) {
      return undef;
   }

   return sub {
      my @fake_records = map { App::RecordStream::Record->new($field => $_) } @_;
      @fake_records = sort { $comparator->($a, $b) } @fake_records;
      return map { $_->{$field} } @fake_records;
   };
}

sub _new_node {
   return [{}, [], -1];
}

sub _touch_node_recurse {
   my ($node, @keys) = @_;

   if(!@keys) {
      return;
   }

   my $hash = $node->[0];
   my $array = $node->[1];

   my $key = shift @keys;
   my $next_node = $hash->{$key};
   if(!$next_node) {
      $next_node = $hash->{$key} = _new_node();
      push @$array, $key;
   }

   _touch_node_recurse($next_node, @keys);
}

sub _dump_node_recurse {
   my ($this, $node, $acc, $fields_left, $values_so_far) = @_;

   my $hash = $node->[0];
   my $array = $node->[1];

   if(!@$fields_left) {
      $node->[2] = scalar(@$acc);
      push @$acc, [@$values_so_far];
      return;
   }

   my $field = shift @$fields_left;

   my @field_values = @$array;
   my $sort = $this->_get_sort($field);
   if(defined($sort))
   {
      @field_values = $sort->(@field_values);
   }

   foreach my $key (@field_values) {
      push @$values_so_far, $key;
      $this->_dump_node_recurse($hash->{$key}, $acc, $fields_left, $values_so_far);
      pop @$values_so_far;
   }

   unshift @$fields_left, $field;
}

sub _find_index_recursive {
   my ($node, @path) = @_;

   if(!@path) {
      return $node->[2];
   }

   my $hash = $node->[0];

   my $k = shift @path;
   my $next_node = $hash->{$k};

   if(!$next_node) {
      die "Missing key " . $k . " followed by " . join(", ", @path);
   }

   return _find_index_recursive($next_node, @path);
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
   $this->use_help_type('keygroups');
   $this->use_help_type('keys');
   $this->add_help_type(
      'full',
      sub { $this->full_help() },
      'Tutorial on toptable, with many examples'
   );
}

sub full_help {
   my $this = shift;
   print $this->format_usage(<<FULL_EXAMPLES);
Full Help

__FORMAT_TEXT__
Lets first take a look at some examples:

Lets take this stream, which is a portion of my recs-fromps:
__FORMAT_TEXT__
\$ recs-fromps --fields rss,pid,state,priority | recs-topn --key state -n 5 | tee /var/tmp/psrecs
{"priority":0,"pid":1,"rss":471040,"state":"sleep"}
{"priority":0,"pid":2,"rss":0,"state":"sleep"}
{"priority":0,"pid":3,"rss":0,"state":"sleep"}
{"priority":0,"pid":4,"rss":0,"state":"sleep"}
{"priority":19,"pid":5,"rss":0,"state":"sleep"}
{"priority":19,"pid":2094,"rss":8351744,"state":"run"}
{"priority":0,"pid":28129,"rss":4784128,"state":"run"}
{"priority":19,"pid":28171,"rss":405504,"state":"run"}

__FORMAT_TEXT__
Ok, Now lets get a table out of this, first we'll collate into some useful information:
__FORMAT_TEXT__
\$ cat /var/tmp/psrecs | recs-collate --perfect --key priority,state -a count
{"priority":0,"count":4,"state":"sleep"}
{"priority":19,"count":1,"state":"sleep"}
{"priority":0,"count":1,"state":"run"}
{"priority":19,"count":2,"state":"run"}

__FORMAT_TEXT__
And lets get a table:
__FORMAT_TEXT__
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

__FORMAT_TEXT__
So, you can see that the VALUES of priority and state are used as the columns /
rows.  So that there is 1 process in state 'run' and priority 0, and 4 in state
'sleep' and priority 0

The --cube option on recs-collate also interacts very well with toptable:
__FORMAT_TEXT__

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

__FORMAT_TEXT__
We added an ALL row and an ALL column.  So from this you can see that there are
5 processes in priority 0, 3 processes in state 'run' and 8 processes all told
in the table (the ALL, ALL intersection)

Now lets see what happens when we have more than 1 left over field.  Lets also
sum up the rss usage of the processes with -a sum,rss on recs-collate:
__FORMAT_TEXT__

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

__FORMAT_TEXT__
So now we have 2 left over fields that aren't columns, count and sum_rss.  What
happens to our table now:
__FORMAT_TEXT__

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

__FORMAT_TEXT__
We now have sum_rss values in this field.  What if we want the other field
(count) displayed?  We just use --v-field to specify what value field to
use:
__FORMAT_TEXT__

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

__FORMAT_TEXT__
Ok, but what if we want to see both left over fields at the same time?  What we
really want is to add a column or row for each of count and sum_rss.  (where
the title of the row is count or sum_rss, not the values of the field).  We can
do this by using the special FIELD specifier like so:
__FORMAT_TEXT__

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

__FORMAT_TEXT__
So, now in one table we can see all the intersections of state and priority
values with the count and sum_rss fields.  Remember that the ALL field (row and
column) are provided by the --cube functionality of recs-collate

Now, say you want to pin value, lets just look at processes in state run for
instance:
__FORMAT_TEXT__

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

__FORMAT_TEXT__
As you can see, this is basically short hand for doing a recs-grep, the transformation to recs group would look like:
__FORMAT_TEXT__

\$ cat /var/tmp/psrecs | recs-collate --perfect --cube --key priority,state -a count -a sum,rss | recs-grep '\$r->{state} eq "run"' | recs-toptable --x priority,FIELD --y state -v sum_rss,count

__FORMAT_TEXT__
(which produces the same table as above).
__FORMAT_TEXT__
FULL_EXAMPLES
}

sub usage {
   my $this = shift;

   my $options = [
      ['x-field|x', 'Add a x field, values of the specified field will become columns in the table, may be a keyspec or a keygroup'],
      ['y-field|y', 'Add a y field, values of the specified field will become rows in the table, may be a keyspec or a keygroup'],
      ['v-field|v', 'Specify the value to display in the table, if multiple value fields are specified and FIELD is not placed in the x or y axes, then the last one wins, may be a keyspec or a keygroup.  If FIELD is in an axis, then --v specifies the fields to be included in that expansion'],
      ['pin', 'Pin a field to a certain value, only display records matching that value, very similar to doing a recs-grep befor toptable.  Takes value of the form: field=pinnedValue, field may be a keyspec (not a keygroup)'],
      ['sort', 'Take sort specifications to sort X values and Y values in headers.  See `recs-sort --help` for details of sort specifications, especially the * option to sort "ALL" to the end, e.g.  "some_field=lex*".'],
      ['noheaders', 'Do not print row and column headers (removes blank rows and columns)'],
      ['records|recs', 'Instead of printing table, output records, one per row of the table.'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-toptable <args> [<files>]
   __FORMAT_TEXT__
   Creates a multi-dimensional pivot table with any number of x and y axises.
   There is additional help available through --full that includes examples

   The x and y rows and columns are the values of the field specified

   X and Y fields can take the special value 'FIELD' which uses unused field
   names as values for the FIELD dimension
   __FORMAT_TEXT__

$args_string

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
