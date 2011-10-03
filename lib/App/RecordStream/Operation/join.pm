package App::RecordStream::Operation::join;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Executor;
use App::RecordStream::InputStream;
use App::RecordStream::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my $left             = 0;
   my $right            = 0;
   my $inner            = 0;
   my $outer            = 0;
   my $operation        = "";
   my $accumulate_right = 0;

   my $spec = {
      "help"             => \&usage,
      "left"             => \$left,
      "right"            => \$right,
      "inner"            => \$inner,
      "outer"            => \$outer,
      "operation=s"      => \$operation,
      "accumulate-right" => \$accumulate_right,
   };

   $this->parse_options($args, $spec);

   if ( ! @$args ) {
      die("You must provide inputkey");
   }

   my $inputkey = shift @$args;

   die("You must provide dbkey") unless (@$args);

   my $dbkey = shift @$args;

   usage("You must provide dbfile") unless (@$args);

   my $dbfile = shift @$args;

   $this->{'ACCUMULATE_RIGHT'} = $accumulate_right;
   $this->{'DB_KEY'}           = $dbkey;
   $this->{'INPUT_KEY'}        = $inputkey;
   $this->{'KEEP_LEFT'}        = $left || $outer;
   $this->{'KEEP_RIGHT'}       = $right || $outer;


   if ( $operation ) {
      $this->{'OPERATION'} = App::RecordStream::Executor->transform_code($operation);
   }

   $this->create_db($dbfile, $dbkey);

   $this->{'KEYS_PRINTED'} = {};
}

sub create_db {
   my $this = shift;
   my $file = shift;
   my $key  = shift;

   my $db_stream = App::RecordStream::InputStream->new('FILE' => $file);
   my %db;
   my $record;

   while($record = $db_stream->get_record()) {
      my $value = $this->value_for_key($record, $key);

      $db{$value} = [] unless ( $db{$value} );
      push @{$db{$value}}, $record;
   }

   $this->{'DB'} = \%db;
}

sub value_for_key {
   my $this   = shift;
   my $record = shift;
   my $key    = shift;

   return ${$record->guess_key_from_spec($key, 0)};
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $value = $this->value_for_key($record, $this->{'INPUT_KEY'});

   my $db = $this->{'DB'};

   if(my $db_records = $db->{$value}) {
      foreach my $db_record (@$db_records) {
         if ($this->{'ACCUMULATE_RIGHT'}) {
            if ($this->{'OPERATION'}) {
               $this->run_expression($db_record, $record);
            }
            else {
               foreach my $this_key (keys %$record) {
                  if (!exists($db_record->{$this_key})) {
                     $db_record->{$this_key} = $record->{$this_key};
                  }
               }
            }
         }
         else {
            if ($this->{'OPERATION'}) {
               my $output_record = App::RecordStream::Record->new(%$db_record);
               $this->run_expression($output_record, $record);
               $this->push_record($output_record);
            }
            else {
               $this->push_record(App::RecordStream::Record->new(%$record, %$db_record));
            }

            if ($this->{'KEEP_LEFT'}) {
               $this->{'KEYS_PRINTED'}->{$value} = 1;
            }
         }
      }
   }
   elsif ($this->{'KEEP_RIGHT'}) {
      $this->push_record($record);
   }

   return 1;
}

# TODO: shove down into executor
sub run_expression {
   my $__MY__this = shift;
   my $d    = shift;
   my $i    = shift;

   no strict;
   no warnings;
   eval $__MY__this->{'OPERATION'};

   if ( $@ ) {
     warn "Code died with $@\n";
   }
}

sub stream_done {
   my $this = shift;
   if ($this->{'KEEP_LEFT'}) {
      foreach my $db_records (values %{$this->{'DB'}}) {
         foreach my $db_record (@$db_records) {
            my $value = $this->value_for_key($db_record, $this->{'DB_KEY'});
            if (!exists($this->{'KEYS_PRINTED'}->{$value})) {
               $this->push_record($db_record);
            }
         }
      }
   }
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
   $this->use_help_type('snippet');
   $this->add_help_type(
      'full',
      \&full_help,
      'Help on join types and accumulate-right'
   );
}

sub full_help {
   print <<HELP_FULL;
Join Types
   For instance, if you did:
   recs-join type typeName dbfile fromfile

   with a db file like:
   { 'typeName': 'foo', 'hasSetting': 1 }
   { 'typeName': 'bar', 'hasSetting': 0 }

   and joined that with
   { 'name': 'something', 'type': 'foo'}
   { 'name': 'blarg', 'type': 'hip'}

   for an inner (default) join, you would get
   { 'name': 'something', 'type': 'foo', 'typeName': 'foo', 'hasSetting': 1}

   for an outer join, you would get
   { 'name': 'something', 'type': 'foo', 'typeName': 'foo', 'hasSetting': 1}
   { 'name': 'blarg', 'type': 'hip'}
   { 'typeName': 'bar', 'hasSetting': 0 }

   for a left join, you would get
   { 'name': 'something', 'type': 'foo', 'typeName': 'foo', 'hasSetting': 1}
   { 'typeName': 'bar', 'hasSetting': 0 }

   for a right join, you would get
   { 'name': 'something', 'type': 'foo', 'typeName': 'foo', 'hasSetting': 1}
   { 'name': 'blarg', 'type': 'hip'}

Accumulate Right:
   Accumulate all input records with the same key onto each db record matching
   that key. This means that a db record can have multiple input records merged
   into it. If no operation is provided, any fields in second or later records
   will be lost due to them being discarded. This option is most useful with a
   user defined operation to handle collisions. For example, one could provide
   an operation to add fields together:

   recs-join --left --operation '
     foreach \$k (keys \%\$i) {
       if (exists(\$d->{\$k})) {
         if (\$k =~ /^value/) {\$d->{\$k} = \$d->{\$k} + \$i->{\$k};}
       } else {
         \$d->{\$k} = \$i->{\$k};
       }
     }' --accumulate-right name name dbfile inputfile
HELP_FULL
}

sub usage {
   my $this = shift;

   my $options = [
      ['left', 'Do a left join'],
      ['right', 'Do a right join'],
      ['inner', 'Do an inner join (This is the default)'],
      ['outer', 'Do an outer join'],
      ['operation', 'An perl expression to evaluate for merging two records together, in place of the default behavior of db fields overwriting input fields. See "Operation" below.'],
      ['accumulate-right', 'Accumulate all input records with the same key onto each db record matching that key. See "Accumulate Right" below.'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-join <args> <inputkey> <dbkey> <dbfile> [<files>]
   __FORMAT_TEXT__
   Records of input (or records from <files>) are joined against records in
   <dbfile>, using field <inputkey> from input and field <dbkey> from <dbfile>.
   Each record from input may match 0, 1, or more records from <dbfile>. Each
   pair of matches will be combined to form a larger record, with fields from
   the dbfile overwriting fields from the input stream. If the join is a left
   join or inner join, any inputs that do not match a dbfile record are
   discarded. If the join is a right join or inner join, any db records that do
   not match an input record are discarded.

   dbkey and inputkey may be key specs, see '--help-keyspecs' for more
   information
   __FORMAT_TEXT__

Arguments:
$args_string

Operation:
   __FORMAT_TEXT__
   The expression provided is evaluated for every pair of db record and input
   record that have matching keys, in place of the default operation to
   overwrite input fields with db fields. The variable \$d is set to a
   App::RecordStream::Record object for the db record, and \$i is set to a 
   App::RecordStream::Record object for the input record. The \$d record is
   used for the result. Thus, if you provide an empty operation, the result
   will contain only fields from the db record.
   __FORMAT_TEXT__

Examples:
   Join type from STDIN and typeName from dbfile
      cat recs | recs-join type typeName dbfile

   Join host name from a mapping file to machines to get IPs
      recs-join host host hostIpMapping machines
USAGE
}

1;
