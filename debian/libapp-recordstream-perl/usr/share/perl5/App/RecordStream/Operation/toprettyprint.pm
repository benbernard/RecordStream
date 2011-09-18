package App::RecordStream::Operation::toprettyprint;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation App::RecordStream::ScreenPrinter);

use App::RecordStream::OutputStream;
use App::RecordStream::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my $only_one    = 0;
   my $key_groups  = App::RecordStream::KeyGroups->new();
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
   $this->{'OUTPUT_STREAM'} = App::RecordStream::OutputStream->new();
   $this->{'NESTED_OUTPUT'} = not $do_not_nest;
};

sub run_operation {
   my $this = shift;

   my $input = $this->get_input_stream();

   # This means that ONLY_ONE doens't work in recs-chain
   if ( $this->{'ONLY_ONE'} ) {
      $this->accept_record($input->get_record());
      return;
   }

   while ( my $record = $input->get_record() ) {
      $this->accept_record($record);
   }
}


sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $specs = $this->{'KEY_GROUPS'}->get_keyspecs_for_record($record);

   $this->print_value('-' x 70 . "\n");
   foreach my $key (sort @$specs) {
      my $value = ${$record->guess_key_from_spec($key)};
      $this->output_value('', $key, $value);
   }
}

sub output_value {
   my $this   = shift;
   my $prefix = shift;
   my $key    = shift;
   my $value  = shift;

   if ( (ref($value) eq 'HASH') &&  $this->{'NESTED_OUTPUT'} ) {
      if ( scalar keys %$value > 0 ) {
         $this->print_value($prefix . "$key = HASH:\n");
         $this->output_hash($prefix . '   ', $value);
      }
      else {
         $this->print_value($prefix . "$key = EMPTY HASH\n");
      }
   }
   elsif ( ref($value) eq 'ARRAY' ) {
      if ( scalar @$value > 0 ) {
         $this->print_value($prefix . "$key = ARRAY:\n");
         $this->output_array($prefix . '   ', $value);
      }
      else {
         $this->print_value($prefix . "$key = EMPTY ARAY\n");
      }
   }
   else {
      my $value_string = $this->{'OUTPUT_STREAM'}->hashref_string($value);
      $this->print_value($prefix . "$key = $value_string\n");
   }
}

sub output_array {
   my $this   = shift;
   my $prefix = shift;
   my $array  = shift;

   my $index = 0;
   foreach my $value (sort @$array) {
      $this->output_value($prefix, $index, $value);
      $index++;
   }
}

sub output_hash {
   my $this   = shift;
   my $prefix = shift;
   my $hash   = shift;

   foreach my $key (sort keys %$hash) {
      my $value = $hash->{$key};
      $this->output_value($prefix, $key, $value);
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
