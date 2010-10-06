package Recs::Operation::toprettyprint;

use strict;

use base qw(Recs::Operation Recs::ScreenPrinter);

use Recs::OutputStream;
use Recs::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my $only_one   = 0;
   my $key_groups = Recs::KeyGroups->new();
   my $spec = {
      "1"        => \$only_one,
      "one"      => \$only_one,
      'keys|k=s' => sub { $key_groups->add_groups($_[1]); },
   };

   $this->parse_options($args, $spec);

   if ( ! $key_groups->has_any_group() ) {
      $key_groups->add_groups('!.!returnrefs');
   }

   $this->{'ONLY_ONE'}      = $only_one;
   $this->{'KEY_GROUPS'}    = $key_groups;
   $this->{'OUTPUT_STREAM'} = Recs::OutputStream->new();
};

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $specs = $this->{'KEY_GROUPS'}->get_keyspecs_for_record($record);

   $this->print_value('-' x 70 . "\n");
   foreach my $key (sort @$specs) {
      my $value = $this->{'OUTPUT_STREAM'}->hashref_string(${$record->guess_key_from_spec($key)});
      $this->print_value("$key = $value\n");
   }
}

sub should_stop {
   my $this = shift;
   return $this->{'ONLY_ONE'};
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
   $this->use_help_type('keygroups');
   $this->use_help_type('keys');
}

sub usage {
   return <<USAGE;
Usage: recs-toprettyprint [files]
  Pretty print records, one key to a line, with a line of dashes (---)
  separating records.  Especially useful for records with very large amounts of
  keys

Arguments:
   -1, --one  Only print the first record
   --keys     Only print out specified keys, Maybe keyspecs may be keygroups,
              see --help-keys for more information

Examples
  # Pretty print records
  recs-toprettyprint

  # Find all keys with 'time' in the name or value
  ... | recs-toprettyprint --one | grep time
USAGE
}

1;
