package Recs::Operation::toprettyprint;

use strict;

use base qw(Recs::Operation Recs::ScreenPrinter);

use Recs::OutputStream;
use Recs::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my $only_one    = 0;
   my $key_groups  = Recs::KeyGroups->new();
   my $do_not_nest = 0;
   my $spec = {
      "1"        => \$only_one,
      "one"      => \$only_one,
      'keys|k=s' => sub { $key_groups->add_groups($_[1]); },
      'nonested' => \$do_not_nest,
   };

   $this->parse_options($args, $spec);

   if ( ! $key_groups->has_any_group() ) {
      $key_groups->add_groups('!.!returnrefs');
   }

   $this->{'ONLY_ONE'}      = $only_one;
   $this->{'KEY_GROUPS'}    = $key_groups;
   $this->{'OUTPUT_STREAM'} = Recs::OutputStream->new();
   $this->{'NESTED_OUTPUT'} = not $do_not_nest;
};

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $specs = $this->{'KEY_GROUPS'}->get_keyspecs_for_record($record);

   $this->print_value('-' x 70 . "\n");
   foreach my $key (sort @$specs) {
      my $value = ${$record->guess_key_from_spec($key)};
      if ( (ref($value) eq 'HASH') &&  $this->{'NESTED_OUTPUT'} ) {
         $this->print_value("$key =\n");
         $this->output_hash('   ', $value);
      }
      else {
         my $value_string = $this->{'OUTPUT_STREAM'}->hashref_string($value);
         $this->print_value("$key = $value_string\n");
      }
   }
}

sub output_hash {
   my $this   = shift;
   my $prefix = shift;
   my $hash   = shift;

   foreach my $key (sort keys %$hash) {
      my $value = $hash->{$key};
      if ( ref($value) eq 'HASH' ) {
         $this->print_value($prefix . "$key =\n");
         $this->output_hash('   ' . $prefix, $value);
      }
      else {
         my $value_string = $this->{'OUTPUT_STREAM'}->hashref_string($value);
         $this->print_value($prefix . "$key = $value_string\n");
      }
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
   --nonested Do not nest the output of hashes, keep each value on one line

Examples
  # Pretty print records
  recs-toprettyprint

  # Find all keys with 'time' in the name or value
  ... | recs-toprettyprint --one | grep time
USAGE
}

1;
