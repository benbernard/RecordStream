package Recs::Operation::toprettyprint;

use strict;

use base qw(Recs::Operation Recs::ScreenPrinter);

use Recs::OutputStream;
use Recs::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my $only_one = 0;
   my $spec = {
      "1"    => \$only_one,
      "one"  => \$only_one,
   };

   $this->parse_options($args, $spec);
   $this->{'ONLY_ONE'}      = $only_one;
   $this->{'OUTPUT_STREAM'} = Recs::OutputStream->new();
};

sub accept_record {
   my $this   = shift;
   my $record = shift;

   $this->print_value('-' x 70 . "\n");
   foreach my $key (sort keys %$record) {
      my $value = $this->{'OUTPUT_STREAM'}->hashref_string($record->{$key});
      $this->print_value("$key = $value\n");
   }
}

sub should_stop {
   my $this = shift;
   return $this->{'ONLY_ONE'};
}

sub usage {
   return <<USAGE;
Usage: recs-toprettyprint [files]
  Pretty print records, one key to a line, with a line of dashes (---)
  separating records.  Especially useful for records with very large amounts of
  keys

Arguments:
   -1, --one Only print the first record
   --help    Bail and output this help screen.

Examples
  # Pretty print records
  recs-toprettyprint

  # Find all keys with 'time' in the name or value
  ... | recs-toprettyprint --one | grep time
USAGE
}

1;
