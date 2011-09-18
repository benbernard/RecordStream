package App::RecordStream::Operation::todb;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use DBI;
use Data::Dumper;
use Tie::IxHash;

use App::RecordStream::DBHandle;
use App::RecordStream::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my ($drop_table, $table_name, $debug);

   my %fields_hash;
   tie %fields_hash, 'Tie::IxHash';

   my $fields = \%fields_hash;

   my $spec = {
      'drop'     => \$drop_table,
      'table=s'  => \$table_name,
      'debug'    => \$debug,
      'key|k|fields|f=s' => sub { shift; add_field($fields, shift) },
   };

   Getopt::Long::Configure("pass_through");
   $this->parse_options($args, $spec);

   $table_name = 'recs' unless $table_name;

   $this->{'TABLE_NAME'} = $table_name;
   $this->{'DEBUG'}      = $debug;
   $this->{'FIELDS'}     = $fields;

   $this->{'DBH'} = App::RecordStream::DBHandle::get_dbh($this->_get_extra_args());

   if ( $drop_table ) {
      my $dbh = $this->{'DBH'};
      eval {
         $this->dbh_do( "DROP TABLE ".$dbh->quote_identifier($table_name));
      };
   }

   $this->{'FIRST'} = 1;
}


sub accept_record {
  my $this   = shift;
  my $record = shift;

   if ( $this->{'FIRST'} ) {
      $this->add_fields($record);
      $this->create_table();
      $this->{'FIRST'} = 0;
   }

   $this->add_row($record);
}

sub add_fields {
   my $this   = shift;
   my $record = shift;
   my $fields = $this->{'FIELDS'};

   return if ( scalar keys %$fields > 0 );

   foreach my $key ( $record->keys() ) {
      $fields->{$key} = 0;
   }
}

sub add_row {
   my $this   = shift;
   my $record = shift;

   my $dbh    = $this->{'DBH'};
   my $name   = $this->{'TABLE_NAME'};
   my $fields = $this->{'FIELDS'};

   $name = $dbh->quote_identifier($name);

   my @keys = keys %$fields;

   my $columns_string = join(',', map {$dbh->quote_identifier($_);} @keys);

   my $values = '';

   foreach my $key (@keys) {
      my $value = ${$record->guess_key_from_spec($key)};
      $value = '' if !defined($value);
      $value = substr($value, 0, 255) if ( ! $fields->{$key} );
      $values .= $dbh->quote($value) . ",";
   }

   chop $values;

   my $sql = "INSERT INTO $name ($columns_string) VALUES ($values)";
   $this->dbh_do($sql);
}

sub create_table {
   my $this   = shift;

   my $dbh    = $this->{'DBH'};
   my $name   = $this->{'TABLE_NAME'};
   my $fields = $this->{'FIELDS'};

   $name = $dbh->quote_identifier($name);

   my $increment_name = 'AUTO_INCREMENT';
   my $db_type = $dbh->get_info( 17 ); # SQL_DBMS_NAME
   $increment_name = 'AUTOINCREMENT' if ( $db_type eq 'SQLite' );

   my $sql = "CREATE TABLE $name ( id INTEGER PRIMARY KEY $increment_name, ";

   foreach my $name (keys %$fields) {
      my $type = $fields->{$name} || 'VARCHAR(255)';
      $name = $dbh->quote_identifier($name);
      $sql .= " $name $type,";
   }

   chop $sql;
   $sql .= " )";

   eval {
     $this->dbh_do($sql);
   };
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
}

sub usage {
   my $usage =  <<USAGE;
   Recs to DB will dump a stream of input records into a database you specify.
   The record fields you want inserted should have the same keys as the column
   names in the database, and the records should be key-value pairs.

   This script will attempt to create the table, if it is not already present.

   --drop   - Drop the table before running create / insert commands.
   --table  - Name of the table to work with defaults to 'recs'
   --debug  - Print all the executed SQL
   --key    - Can either be a name value pair or just a name.  Name value pairs
              should be fieldName=SQL Type.  If any fields are specified, they
              will be the only fields put into the db.  May be specified
              multiple times, may also be comma separated.  Type defaults to
              VARCHAR(255)
              Keys may be key specs, see '--help-keyspecs' for more

USAGE

   return $usage . App::RecordStream::DBHandle::usage() .  <<EXAMPLES;

Examples:
   # Just put all the records into the recs table
   recs-todb --type sqlite --dbfile testDb --table recs

   # Just put description, status, and user into the table, make the records
   # the only thing in the DB
   recs-todb --dbfile testDb --drop --key status,description=TEXT --key user
EXAMPLES
}

sub add_field {
   my $hash  = shift;
   my $arg  = shift;

   my @specs;

   push @specs, split(',', $arg);

   foreach my $spec ( @specs ) {
      my ($field,$sql_spec) = split('=', $spec);
      $hash->{$field} = $sql_spec;
   }
}

sub dbh_do {
   my $this = shift;
   my $sql  = shift;
   my $dbh = $this->{'DBH'};

   if ( $this->{'DEBUG'} ) {
     print "Running: $sql\n";
   }

   $dbh->do($sql);
}

1;
