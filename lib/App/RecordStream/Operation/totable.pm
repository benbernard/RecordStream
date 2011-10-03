package App::RecordStream::Operation::totable;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Accumulator App::RecordStream::Operation);

use App::RecordStream::OutputStream;

sub init {
   my $this = shift;
   my $args = shift;

   my $no_header   = 0;
   my $delimiter   = "\t";
   my $spreadsheet = 0;
   my $clear       = 0;

   my $key_groups  = App::RecordStream::KeyGroups->new();

   my $spec = {
      "no-header|n"     => \$no_header,
      "key|k|field|f=s" => sub { $key_groups->add_groups($_[1]); },
      "delim|d=s"       => \$delimiter,
      "clear"           => \$clear,
      "spreadsheet|s"   => \$spreadsheet,
   };

   $this->parse_options($args, $spec);

   if ( ! $key_groups->has_any_group() ) {
      $key_groups->add_groups('!.!returnrefs');
   }

   $this->{'NO_HEADER'}     = $no_header;
   $this->{'KEY_GROUPS'}    = $key_groups;
   $this->{'DELIMITER'}     = $delimiter;
   $this->{'SPREADSHEET'}   = $spreadsheet;
   $this->{'CLEAR'}         = $clear;
}

sub stream_done {
   my $this = shift;

   my $records   = $this->get_records();
   my $key_group = $this->{'KEY_GROUPS'};
   my %widths;

   foreach my $record (@$records) {
      my $specs = $key_group->get_keyspecs_for_record($record);

      foreach my $field (@$specs) {
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

   my $fields = [ sort keys %widths ];
   $this->{'FIELDS'} = $fields;

   if(!$no_header) {
      $this->push_line(
         $this->format_row(
            $fields,
            \%widths,
            sub { return $_[1]; },
            ""
         )
      );

      if ( ! $this->{'SPREADSHEET'} ) {
         $this->push_line(
            $this->format_row(
               $fields,
               \%widths,
               sub { return ("-" x $widths{$_[1]}); },
               ""
            )
         );
      }
   }

   my %last = map { $_ => "" } (keys(%widths));
   foreach my $record (@$records) {
      $this->push_line(
         $this->format_row(
            $fields,
            \%widths,
            \&format_field,
            [$record, \%last]
         )
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
      $value = App::RecordStream::OutputStream::hashref_string($value);
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
      $value = App::RecordStream::OutputStream::hashref_string($value);
   }

   return $value;
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
      ['no-header|n', 'Do not print column headers'],
      ['key|k <field name>', 'May be comma separated, may be specified multiple times.  Specifies the fields to put in the table.  May be a keyspec or a keygroup, see --help-keys'],
      ['spreadsheet', 'Print out in a format suitable for excel.  1. Does not print line of -s after header 2. Separates by single character rather than series of spaces'],
      ['delimiter <string>', 'Only useful with --spreadsheet, delimit with <string> rather than the default of a tab'],
      ['clear', 'Put blanks in cells where all of the row so far matches the row above.'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-totable <args> [<files>]
   __FORMAT_TEXT__
   Pretty prints a table of records to the screen.  Will read in the entire
   record stream to determine column size, and number of columns
   __FORMAT_TEXT__

$args_string

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
