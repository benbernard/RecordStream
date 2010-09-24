package Recs::Operation::delta;

use strict;

use base qw(Recs::Operation);

sub init
{
   my $this = shift;
   my $args = shift;

   my @keys;
   my $spec = {
      "key|k=s" => sub { push @keys, split(/,/, $_[1]); },
   };

   $this->parse_options($args, $spec);

   usage('Must specify --key') unless @keys;

   $this->{'KEYS'} = \@keys;
}

sub accept_record
{
   my $this   = shift;
   my $record = shift;

   my $last_record = $this->{'LAST_RECORD'};

   if ( $last_record ) {
      foreach my $key (@{$this->{'KEYS'}})
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
}

sub usage
{
   return <<USAGE;
Usage: recs-delta <args> [<files>]
   Transforms absolute values into deltas between adjacent records.

Arguments:
   --key|-k <keys>               Comma separated list of the fields that should be transformed.
                                 Fields not in this list will be passed through unchanged, using
                                 the *first* record of each delta pair.
                                 This may be a key spec, see 'man recs' for more information

Help / Usage Options:
   --help                         Bail and output this help screen.

Examples:
   Transforms a cumulative counter of errors into a count of errors per record.
     recs-delta --key=errors
USAGE
}

1;
