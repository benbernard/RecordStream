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
}

sub run_operation {
   my $this = shift;

   my $parser = $this->{'PARSER'};

   local @ARGV = @{$this->_get_extra_args()};

   my $do_headers = $this->{'HEADER_LINE'};
   while(my $row = $parser->getline(*ARGV)) {
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
   return <<USAGE;
Usage: recs-fromcsv <args> [<files>]
   Each line of input (or lines of <files>) is split on csv to
   produce an output record.  Fields are named numerically (0, 1, etc.) or as
   given by --field.

Arguments:
   --key|-k <keys> Comma separated list of field names.  May be specified
                   multiple times, may be key specs
   --header        Take field names from the first line of input.
   --strict        Do not trim whitespaces, allow loose quoting (quotes inside
                   qutoes), or allow the use of escape characters when not
                   strictly needed.  (not recommended, for most cases)

Examples:
   Parse csv separated fields x and y.
      recs-fromcsv --field x,y
   Parse data with a header line specifying fields
      recs-fromcsv --header
USAGE
}

1;
