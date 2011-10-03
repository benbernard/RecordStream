package App::RecordStream::Operation::stream2table;

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

sub init {
   my $this = shift;
   my $args = shift;

   my $field;
   my $spec = {
      "field|f=s" => \$field,
   };

   $this->parse_options($args, $spec);

   die "You must specify a --field option\n" unless defined($field);

   $this->{'FIELD'} = $field;
   $this->{'REMOVE_FIELD'} = (not ($field =~ m![/@]!));
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $key = ${$record->guess_key_from_spec($this->{'FIELD'})};

   if ( $this->{'REMOVE_FIELD'} ) {
     $record->remove($this->{'FIELD'});
   }

   $this->{'HASH'}->{$key} ||= [];
   push @{$this->{'HASH'}->{$key}}, $record;

   return 1;
}

sub stream_done {
  my $this = shift;

  while(scalar keys %{$this->{'HASH'}} > 0) {
    my $record = App::RecordStream::Record->new();
    my $found = 0;
    foreach my $key (keys %{$this->{'HASH'}}) {
      my $old_record = shift @{$this->{'HASH'}->{$key}};
      if ( $old_record ) {
        $record->set($key, $old_record);
        $found = 1;
      }
      else {
        delete $this->{'HASH'}->{$key};
      }
    }
    $this->push_record($record) if ( $found );
  }
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
}

sub usage {
   my $this = shift;

   my $options = [
      ['field <FIELD>', 'Field to use as the column key, may be a keyspec'],
   ];

   my $args_string = $this->options_string($options);

   my $usage =  <<USAGE;
Usage: recs-stream2table <args> [<files>]
   __FORMAT_TEXT__
   Transforms a list of records, combinging records based on a column, FIELD.
   In order, the values of the column will be added to the output records.

   Note: This script spools the stream into memory
   __FORMAT_TEXT__

   This stream:
   { "column": "foo", "data": "foo1" }
   { "column": "foo", "data": "foo2" }
   { "column": "boo", "data": "boo1" }
   { "column": "boo", "data": "boo2" }

   with recs-stream2table --field column becomes:
   {"boo":{"data":"boo1"},"foo":{"data":"foo1"}}
   {"boo":{"data":"boo2"},"foo":{"data":"foo2"}}

   __FORMAT_TEXT__
   Hint: use recs-flatten if you want those values to be in the top level of
   the record

   The full input record will be associated with the value of the FIELD.  The
   field itself will be removed from the nested record if the passed field is
   not a key spec.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   # Transform a record stream with each stat on one line to a stream with one
   # value for each stat present on one line
   ... | recs-stream2table --field stat
USAGE
}

1;
