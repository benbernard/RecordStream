package App::RecordStream::Operation::fromdb;

our $VERSION = "3.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use DBI;

use App::RecordStream::DBHandle;
use App::RecordStream::Record;

sub init {
   my $this = shift;
   my $args = shift;

   my ($table_name, $sql);
   my $spec = {
      'table=s' => \$table_name,
      'sql=s'   => \$sql,
   };

   Getopt::Long::Configure("pass_through");
   $this->parse_options($args, $spec);

   $this->{'TABLE_NAME'} = $table_name;

   my $dbh = App::RecordStream::DBHandle::get_dbh($args);
   $this->{'DBH'} = $dbh;

   die("Must define --table or --sql\n") unless ( $table_name || $sql );

   unless ( $sql ) {
     $sql = "SELECT * FROM $table_name";
   }

   $this->{'SQL'} = $sql;
}

sub wants_input {
   return 0;
}

sub stream_done {
  my $this = shift;

  my $sth = $this->{'DBH'}->prepare($this->{'SQL'});
  $sth->execute();

  while ( my $row = $sth->fetchrow_hashref() ) {
    my $record = App::RecordStream::Record->new(%$row);
    $this->push_record($record);
  }
}

sub usage {
   my $this = shift;

   my $options = [
      [ 'table', 'Name of the table to dump, this is a shortcut for --sql \'SELECT * from tableName\''],
      [ 'sql', 'SQL select statement to run'],
   ];

   my $args_string = $this->options_string($options);

   my $usage =  <<USAGE;
   __FORMAT_TEXT__
   Recs from DB will execute a select statement on a database of your choice,
   and create a record stream from the results.  The keys of the record will be
   the column names and the values the row values.
   __FORMAT_TEXT__

$args_string

USAGE

   return $usage . App::RecordStream::DBHandle::usage() .  <<EXAMPLES;
Examples:
   # Dump a table
   recs-fromdb --type sqlite --dbfile testDb --table recs

   # Run a select statement
   recs-fromdb --dbfile testDb --sql 'SELECT * FROM recs WHERE id > 9'
EXAMPLES
}

1;
