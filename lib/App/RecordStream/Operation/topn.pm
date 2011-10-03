package App::RecordStream::Operation::topn;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

sub init {
   my $this = shift;
   my $args = shift;


   my $top = 10;
   my $value_delimiter = "9t%7Oz%]";
   my $key_groups = App::RecordStream::KeyGroups->new();

   my $spec = {
      "key|k=s"     => sub { $key_groups->add_groups($_[1]); },
      "topn|n=i"    => \$top,
      "delimiter=s" => \$value_delimiter,
   };

   $this->parse_options($args, $spec);

   die "Must at least specify --topn <value>" unless $top;

   $this->{'KEY_GROUPS'} = $key_groups;
   $this->{'NUM'}        = $top;
   $this->{'DELIM'}      = $value_delimiter,

   $this->{'PRIOR_KEY_VALUES'} = "";
}

sub init_keys {
   my $this   = shift;
   my $record = shift;

   $this->{'KEYS'} = $this->{'KEY_GROUPS'}->get_keyspecs($record);
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   if ( ! $this->{'KEYS'} ) {
      $this->init_keys($record);
   }

   my $current_key_values = "";
   foreach my $k ( @{$this->{'KEYS'}} ) {
     $current_key_values .= ${$record->guess_key_from_spec( $k )} . $this->{'DELIM'};
   }

   $this->{'NUM_SEEN'}->{$current_key_values}++;
   if( $this->{'NUM_SEEN'}->{$current_key_values} <= $this->{'NUM'} ) {
     $this->push_record($record);
   }

   return 1;
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
   $this->use_help_type('keygroups');
   $this->use_help_type('keys');
}

sub usage
{
   my $this = shift;

   my $options = [
      ['key <keyspec>', 'Comma separated list of fields.  May be specified multiple times.  May be a keyspec or keygroup, see \'--help-keys\' for more'],
      ['topn | -n <number>', 'Number of records to output.  Default is 10.'],
      ['delimiter <string>', 'String used internally to delimit values when performing a topn on a keyspec that inlcudeds multiple keys.  This value defaults to "9t%7Oz%]" which may - under unusual and bizarre corner cases - cause false positive key matches if your values contain this value.  You can set this to any string.'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-topn <args> [<files>]
   __FORMAT_TEXT__
   Outputs the top n records from input stream or from <files>.  You may
   segment the input stream based on a list of keys such that unique values
   of keys are treated as distinct input streams.  This enables
   top n listings per value groupings.  The key values need not be contiguous
   in the input record stream.
   __FORMAT_TEXT__

$args_string

Examples:
   Output just the top 5 records
      cat records | recs-topn -n=5
    (this is equivalent to executing "cat records | recs-grep '\$line < 5'")

   Output just 10 records for each area
      cat records | recs-sort --key area | recs-topn -n=10 --key area

   Output the top 10 longest running queries per area and priority level
      cat records | recs-sort --key area,priority,runtime=-n  | recs-topn -n=10 --key area,priority
USAGE
}

1;
