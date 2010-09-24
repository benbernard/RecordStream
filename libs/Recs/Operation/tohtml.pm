package Recs::Operation::tohtml;

use strict;
use warnings;

use base qw(Recs::Operation Recs::ScreenPrinter);

sub init {
   my $this = shift;
   my $args = shift;

   my @fields;
   my $no_header;
   my $row_attributes = '';
   my $cell_attributes = '';

   my $spec = {
      'fields|f=s'       => sub { push @fields, split(',', $_[1]) },
      'noheader'         => \$no_header,
      'rowattributes=s'  => \$row_attributes,
      'cellattributes=s' => \$cell_attributes,
   };

   $this->parse_options($args, $spec);

   $this->{'FIELDS'}          = \@fields;
   $this->{'NO_HEADER'}       = $no_header;
   $this->{'ROW_ATTRIBUTES'}  = $row_attributes;
   $this->{'CELL_ATTRIBUTES'} = $cell_attributes;
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   $this->print_start($record);

   my $fields          = $this->{'FIELDS'};
   my $row_attributes  = $this->{'ROW_ATTRIBUTES'};
   my $cell_attributes = $this->{'CELL_ATTRIBUTES'};

   $this->print_value("  <tr $row_attributes>\n");

   foreach my $field (@$fields) {
      my $value = ${$record->guess_key_from_spec($field)} || '';
      $this->print_value("    <td $cell_attributes>$value</td>\n");
   }

   $this->print_value("  </tr>\n");
}

sub print_start {
   my $this   = shift;
   my $record = shift;

   return if ( $this->{'PRINTED_START'} );
   $this->{'PRINTED_START'} = 1;

   $this->print_value("<table>\n");

   my $fields = $this->{'FIELDS'};

   if ( scalar @$fields == 0 ) {
      @$fields = keys %$record;
   }

   return if ( $this->{'NO_HEADER'} );

   $this->print_header();
}

sub print_header {
   my $this = shift;

   my $fields = $this->{'FIELDS'};

   my $row_attributes  = $this->{'ROW_ATTRIBUTES'};
   my $cell_attributes = $this->{'CELL_ATTRIBUTES'};

   $this->print_value("  <tr $row_attributes>\n");

   foreach my $field (@$fields) {
      $this->print_value("    <th $cell_attributes>$field</th>\n");
   }

   $this->print_value("  </tr>\n");
}

sub stream_done {
   my $this = shift;
   $this->print_value("</table>\n");
}

sub usage {
   return <<USAGE;
Usage: recs-totable <args> [<files>]
   Prints out an html table for the records from input or from <files>.

   --fields <fields> - Fields to print in the table.  May be specified multiple
                       times, may be comma separated.  Default to all fields in
                       the first record.  May be a key spec, see 'man recs' for
                       more information
   --noheader        - Do not print the header row
   --rowattributes   - HTML attributes to put on the tr tags
   --cellattributes  - HTML attributes to put on the td and th tag
   --help            - Bail and output this help screen.

Examples:
   Print all fields
      recs-tohhtml
   Print foo and bar fields, without a header
      recs-tohtml --fields foo,bar --noheader
USAGE
}

1;
