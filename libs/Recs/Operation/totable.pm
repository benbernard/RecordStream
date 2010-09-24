package Recs::Operation::totable;

use strict;
use warnings;

use base qw(Recs::Accumulator Recs::Operation Recs::ScreenPrinter);

use Recs::OutputStream;

sub init {
   my $this = shift;
   my $args = shift;

   my $no_header   = 0;
   my $delimiter   = "\t";
   my $spreadsheet = 0;
   my $clear       = 0;
   my @fields;

   my $spec = {
      "no-header|n"   => \$no_header,
      "field|f=s"     => sub { push @fields, split(/,/, $_[1]); },
      "delim|d=s"     => \$delimiter,
      "clear"         => \$clear,
      "spreadsheet|s" => \$spreadsheet,
   };

   $this->parse_options($args, $spec);

   $this->{'NO_HEADER'}     = $no_header;
   $this->{'FIELDS'}        = \@fields;
   $this->{'DELIMITER'}     = $delimiter;
   $this->{'SPREADSHEET'}   = $spreadsheet;
   $this->{'CLEAR'}         = $clear;
   $this->{'OUTPUT_STREAM'} = Recs::OutputStream->new();
}

sub stream_done {
   my $this = shift;

   my $records = $this->get_records();
   my $fields  = $this->{'FIELDS'};

   my %fields_hash;
   foreach(@$fields) {
      $fields_hash{$_} = "";
   }

   my %widths;

   foreach my $record (@$records) {
      my @fields = keys %fields_hash;
      if ( scalar @fields == 0 ) {
         @fields = keys %$record;
      }
     
      foreach my $field (@fields) {
         if(%fields_hash && !exists($fields_hash{$field})) {
            next;
         }

         if(!exists($widths{$field})) {
            $widths{$field} = 0;
         }

         $widths{$field} = max($widths{$field}, length($this->extract_field($record, $field)));
      }
   }

   my $no_header = $this->{'NO_HEADER'};
   if(!$no_header) {
      foreach my $field (keys(%widths)) {
         $widths{$field} = max($widths{$field}, length($field));
      }
   }

   if(!@$fields) {
      $fields = [ sort keys %widths ];
   }

   if(!$no_header) {
      $this->print_value(
         $this->format_row(
            $fields, 
            \%widths, 
            sub { return $_[1]; }, 
            ""
         ) . "\n"
      );

      if ( ! $this->{'SPREADSHEET'} ) {
         $this->print_value(
            $this->format_row(
               $fields, 
               \%widths, 
               sub { return ("-" x $widths{$_[1]}); }, 
               ""
            ) . "\n"
         );
      }
   }

   my %last = map { $_ => "" } (keys(%widths));
   foreach my $record (@$records) {
      $this->print_value(
         $this->format_row(
            $fields, 
            \%widths, 
            \&format_field,
            [$record, \%last]
         ) . "\n"
      );
   }
}

sub format_field
{
   my ($this, $field, $thunk) = @_;
   my ($r, $lastr) = @$thunk;

   my $value = ${$r->guess_key_from_spec($field)};
   $value = '' if ( ! defined $value );

   if ( ref($value) )
   {
      $value = $this->{'OUTPUT_STREAM'}->hashref_string($value);
   }

   if($this->{'CLEAR'})
   {
      if($value eq $lastr->{$field})
      {
         # This column matches the "last" value so we clear the cell.
         $value = "";
      }
      else
      {
         # This column did not match so we do not clear the cell.  We also
         # invalidate all "last" field values to the right of this column.
         my $startInvalidating = 0;
         for(@{$this->{'FIELDS'}})
         {
            if($_ eq $field)
            {
               $startInvalidating = 1;
            }
            elsif($startInvalidating)
            {
               $lastr->{$_} = "";
            }
         }
         $lastr->{$field} = $value;
      }
   }

   return $value;
}


sub format_row {
   my ($this, $fieldsr, $widthsr, $format_fieldr, $thunk) = @_;

   my $first = 1;
   my $row_string = "";

   foreach my $field (@$fieldsr) {
      my $field_string = $format_fieldr->($this, $field, $thunk);

      unless ( defined $field_string ) {
        $field_string = '';
      }

      if ( (! $this->{'SPREADSHEET'}) &&
           (length($field_string) < $widthsr->{$field})) {

         $field_string .= " " x ($widthsr->{$field} - length($field_string));
      }

      if($first) {
         $first = 0;
      }
      else {
         $row_string .= ($this->{'SPREADSHEET'}) ? $this->{'DELIMITER'} : "   ";
      }

      $row_string .= $field_string;
   }

   return $row_string;
}

# Max helper function
sub max {
   my $max = shift;

   foreach my $value (@_) {
      if($value > $max) {
         $max = $value;
      }
   }

   return $max;
}

sub extract_field {
   my $this   = shift;
   my $record = shift;
   my $field  = shift;

   my $value = ${$record->guess_key_from_spec($field)};
   $value = '' if ( ! defined $value );

   if ( ref($value) )
   {
      $value = $this->{'OUTPUT_STREAM'}->hashref_string($value);
   }

   return $value;
}

sub usage {
   return <<USAGE;
Usage: recs-totable <args> [<files>]
   Pretty prints a table of records to the screen.  Will read in the entire
   record stream to determine column size, and number of columns
   
   --no-header|n           Do not print column headers
   --field|f <field name>  May be comma separated, may be specified multiple
                           times.  Specifies the fields to put in the table.
   --spreadsheet           Print out in a format suitable for excel.
                           1. Does not print line of -s after header
                           2. Separates by single character rather than series 
                               of spaces
   --delimiter <string>    Only useful with --spreadsheet, delimit with 
                           <string> rather than the default of a tab
   --clear                 Put blanks in cells where all of the row so far
                           matches the row above.
   --help                  Bail and print this usage

Examples:
   Display a table
      recs-totable
   Display only one field
      recs-totable -f foo
   Display two fields without a header
      recs-totable -f foo -f bar --no-header
USAGE
}

1;
