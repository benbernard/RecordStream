package App::RecordStream::Operation::sort;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Accumulator App::RecordStream::Operation);

sub init {
   my $this = shift;
   my $args = shift;

   my @keys;
   my $reverse;

   my $spec = {
      "key|k=s"   => sub { push @keys, split(/,/, $_[1]); },
      "reverse|r" => \$reverse,
   };

   $this->parse_options($args, $spec);

   $this->{'KEYS'}    = \@keys;
   $this->{'REVERSE'} = $reverse;
}

sub stream_done {
   my $this = shift;

   my @records = App::RecordStream::Record::sort($this->get_records(), @{$this->{'KEYS'}});

   if ( $this->{'REVERSE'} ) {
      @records = reverse @records;
   }

   foreach my $record (@records) {
      $this->push_record($record);
   }
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
}

sub usage {
   return <<USAGE;
Usage: recs-sort <args> [<files>]
   Sorts records from input or from <files>.  You may sort on a list of keys,
   each key sorted lexically (alpha order) or numerically

   --key <keyspec> - May be comma separated, May be specified multiple times.
                     Each keyspec is a name or a name=sortType.  The name
                     should be a field name to sort on.  The sort type should
                     be either lexical or numeric.  Default sort type is
                     lexical (can also use nat, lex, n, and l).  Additionallly,
                     the sort type may be prefixed with '-' to indicate a
                     decreasing sort order.  Additionally, the sort type may be
                     postfixed with "*" to sort the special value "ALL" to the
                     end (useful for the output of recs-collate --cube).  See
                     perldoc for App::RecordStream::Record for more on sort
                     specs.  May be a key spec, see '--help-keyspecs' for more.
                     Cannot be a keygroup.
    --reverse      - Reverses the sort order

Examples:
   Sort on the id field, a numeric
      recs-sort --key id=numeric
   Sort on age, then name
      recs-sort --key age=numeric,name
   Sort on decreasing size, name
      recs-sort --key size=-numeric --key name
USAGE
}

1;
