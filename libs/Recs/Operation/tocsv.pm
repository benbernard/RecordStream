package Recs::Operation::tocsv;

use strict;

use base qw(Recs::Operation Recs::ScreenPrinter);

use Recs::Record;
use Text::CSV;

sub init {
   my $this = shift;
   my $args = shift;

   my @keys;
   my $header = 1;
   my $spec = {
      "key|k=s"     => sub { push @keys, split(/,/, $_[1]); },
      "noheader|nh" => sub { $header = 0 },
   };

   $this->parse_options($args, $spec);
   $this->{'KEYS'}    = \@keys;

   # Extra arguments are to handle new lines in field values
   $this->{'CSV'}     = Text::CSV->new({ binary => 1, eol => $/ });

   $this->{'FIRST'}   = 1;
   $this->{'HEADERS'} = $header;
};

sub accept_record {
   my $this   = shift;
   my $record = shift;

   if ( $this->{'FIRST'} ) {
      $this->{'FIRST'} = 0;

      if ( scalar @{$this->{'KEYS'}} == 0 ) {
         $this->{'KEYS'} = [keys %$record];
      }

      if ( $this->{'HEADERS'} ) {
         $this->output_values($this->{'KEYS'});
      }
   }

   my @values;
   foreach my $key (@{$this->{'KEYS'}}) {
      push @values, ${$record->guess_key_from_spec($key)};
   }

   $this->output_values(\@values);
}

sub output_values {
   my $this   = shift;
   my $values = shift;

   my $csv = $this->{'CSV'};
   $csv->combine(@$values);
   $this->print_value($csv->string());
}

sub usage {
   return <<USAGE;
Usage: recs-tocsv <options> [files]
  This script outputs csv formatted recs.

Arguments:
   --noheader|--nh    Do not output headers on the first line
   --key|-k <keyspec> Comma separated key specs to output.  Defaults to all
                      fields in first record.
   --help             Bail and output this help screen.

Examples
  # Print records to csv format with headers
  recs-tocsv myrecords

  # Only print time and a nested value of stat/avg
  ... | recs-tocsv --key time,stat/avg
USAGE
}

1;
