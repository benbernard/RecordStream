package App::RecordStream::Operation::fromcsv;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use Text::CSV;

sub init {
   my $this = shift;
   my $args = shift;

   my @fields;
   my $header_line = undef;
   my $strict = 0;

   my $spec = {
      "keys|k|field|f=s" => sub { push @fields, split(/,/, $_[1]); },
      "header"           => \$header_line,
      "strict"           => \$strict,
   };

   $this->parse_options($args, $spec);

   my $csv_args = {
      binary => 1,
      eol    => $/,
   };

   if ( !$strict ) {
      $csv_args->{'allow_whitespace'}    = 1;
      $csv_args->{'allow_loose_quotes'}  = 1;
      $csv_args->{'allow_loose_escapes'} = 1;
   }

   $this->{'FIELDS'}      = \@fields;
   $this->{'HEADER_LINE'} = $header_line;
   $this->{'PARSER'}      = new Text::CSV($csv_args);
   $this->{'EXTRA_ARGS'}  = $args;
}

sub wants_input {
   return 0;
}

sub stream_done {
   my $this = shift;

   my $files = $this->{'EXTRA_ARGS'};

   if ( scalar @$files > 0 ) {
      foreach my $file ( @$files ) {
         $this->update_current_filename($file);

         open(my $fh, '<', $file) or die "Could not open file: $!\n";
         $this->get_records_from_handle($fh);
         close $fh;
      }
   }
   else {
      $this->get_records_from_handle(\*STDIN);
   }
}

sub get_records_from_handle {
   my ($this, $handle) = @_;

   my $parser     = $this->{'PARSER'};
   my $do_headers = $this->{'HEADER_LINE'};

   while(my $row = $parser->getline($handle)) {
      if ( $do_headers ) {
         push @{$this->{'FIELDS'}}, @$row;
         $do_headers = 0;
         next;
      }

      my @values = @$row;

      my $record = App::RecordStream::Record->new();
      for(my $i = 0; $i < @values; ++$i)
      {
         my $key = $this->{'FIELDS'}->[$i] || $i;
         ${$record->guess_key_from_spec($key)} = $values[$i];
      }
      $this->push_record($record);
   }
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
}

sub usage
{
   my $this = shift;

   my $options = [
      [ 'key|k <keys>', 'Comma separated list of field names.  May be specified multiple times, may be key specs' ],
      [ 'header', 'Take field names from the first line of input' ],
      [ 'strict', 'Do not trim whitespaces, allow loose quoting (quotes inside qutoes), or allow the use of escape characters when not strictly needed.  (not recommended, for most cases)' ],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-fromcsv <args> [<files>]
   __FORMAT_TEXT__
   Each line of input (or lines of <files>) is split on csv to
   produce an output record.  Fields are named numerically (0, 1, etc.) or as
   given by --field.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Parse csv separated fields x and y.
      recs-fromcsv --field x,y
   Parse data with a header line specifying fields
      recs-fromcsv --header
USAGE
}

1;
