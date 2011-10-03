package App::RecordStream::Operation::tocsv;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;
use Text::CSV;

sub init {
   my $this = shift;
   my $args = shift;

   my $header = 1;
   my $key_groups = App::RecordStream::KeyGroups->new();
   my $spec = {
      "key|k=s"     => sub { $key_groups->add_groups($_[1]); },
      "noheader|nh" => sub { $header = 0 },
   };

   $this->parse_options($args, $spec);
   $this->{'KEY_GROUPS'} = $key_groups;

   # Extra arguments are to handle new lines in field values
   $this->{'CSV'}     = Text::CSV->new({ binary => 1 });

   $this->{'FIRST'}   = 1;
   $this->{'HEADERS'} = $header;
};

sub accept_record {
   my $this   = shift;
   my $record = shift;

   if ( $this->{'FIRST'} ) {
      $this->{'FIRST'} = 0;

      if ( $this->{'KEY_GROUPS'}->has_any_group() ) {
         $this->{'KEYS'} = $this->{'KEY_GROUPS'}->get_keyspecs($record);
      }
      else {
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

   return 1;
}

sub output_values {
   my $this   = shift;
   my $values = shift;

   my $csv = $this->{'CSV'};
   $csv->combine(@$values);
   $this->push_line($csv->string());
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
      ['noheader|--nh', 'Do not output headers on the first line'],
      ['key|-k <keyspec>', 'Comma separated keys to output.  Defaults to all fields in first record.  May be a keyspec, may be a keyspec group'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-tocsv <options> [files]
   __FORMAT_TEXT__
   This script outputs csv formatted recs.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples
  # Print records to csv format with headers
  recs-tocsv myrecords

  # Only print time and a nested value of stat/avg
  ... | recs-tocsv --key time,stat/avg
USAGE
}

1;
