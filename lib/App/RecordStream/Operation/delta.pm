package App::RecordStream::Operation::delta;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

sub init
{
   my $this = shift;
   my $args = shift;

   my $key_groups = App::RecordStream::KeyGroups->new();
   my $spec = {
      "key|k=s" => sub { $key_groups->add_groups($_[1]); },
   };

   $this->parse_options($args, $spec);

   usage('Must specify --key') unless $key_groups->has_any_group();

   $this->{'KEY_GROUPS'} = $key_groups;
}

sub accept_record
{
   my $this   = shift;
   my $record = shift;
   my $last_record = $this->{'LAST_RECORD'}; 
   if ( $last_record ) {
      foreach my $key (@{$this->{'KEY_GROUPS'}->get_keyspecs($last_record)})
      {
         if ( ${$record->guess_key_from_spec($key)} and ${$last_record->guess_key_from_spec($key)} )
         {
            ${$last_record->guess_key_from_spec($key)} = ${$record->guess_key_from_spec($key)} - ${$last_record->guess_key_from_spec($key)};
         }
         else
         {
            ${$last_record->guess_key_from_spec($key)} = undef;
         }
      }
      $this->push_record($last_record);
   }

   $this->{'LAST_RECORD'} = $record;

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
      [ 'key|-k <keys>', 'Comma separated list of the fields that should be transformed.  Fields not in this list will be passed through unchanged, using the *first* record of each delta pair.  This may be a keyspec or a keygroup, see "--help-keyspecs" for more information'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-delta <args> [<files>]
   __FORMAT_TEXT__
   Transforms absolute values into deltas between adjacent records.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Transforms a cumulative counter of errors into a count of errors per record.
     recs-delta --key=errors
USAGE
}

1;
