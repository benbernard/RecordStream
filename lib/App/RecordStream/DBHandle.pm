package App::RecordStream::DBHandle;

our $VERSION = "3.4";

use strict;
use warnings;

use DBI;
use Data::Dumper;
use Getopt::Long;

my $MODES = {
   'sqlite' => {
      'dbfile' => ['=s', 'testDb', 'Local file for database'],
   },
   'mysql'  => {
      'host'   => ['=s', undef, 'Mysql Host'],
      'dbname' => ['=s', undef, 'Database to connect to'],
   },
   'oracle' => {
       'db' => ['=s', undef, 'Database name (tnsname) to connect to'],
   },
   'main' => {
      'type'     => ['=s', 'sqlite', 'Type of database to connect to'],
      'user'     => ['=s', '', 'User to connect as'],
      'password' => ['=s', '', 'Password to connect as'],
   },
};

my $DESCRIPTIONS = {
   'sqlite' => 'A simple local file based db',
   'mysql'  => 'Connect to a remote mysql database',
   'oracle' => 'Connect to a remote Oracle database',
};

my $DISPATCH_TABLE = {
   'sqlite' => \&sqlite_dbh,
   'mysql'  => \&mysql_dbh,
   'oracle' => \&oracle_dbh,
};

sub get_dbh {
   my $args    = shift;
   my $options = {};

   parse_options($options, 'main', $args);

   my $type = $options->{'type'};
   parse_options($options, $type, $args);

   return $DISPATCH_TABLE->{$type}->($options);
}

sub parse_options {
   my $options = shift;
   my $mode    = shift;
   my $args    = shift || \@ARGV;

   my $spec = get_option_spec($mode, $options);
   local @ARGV = @$args;

   Getopt::Long::Configure("pass_through");
   GetOptions( %$spec );
   set_defaults($mode, $options);

   @$args = @ARGV;
}

sub set_defaults {
   my $mode = shift;
   my $opts = shift;

   my $options = $MODES->{$mode};
   foreach my $opt ( keys %$options ) {
      my $default   = @{$options->{$opt}}[1];

      if ( (not defined $default) && (!$opts->{$opt}) ) {
         die "Must define $opt for type $mode";
      }

      $opts->{$opt} = $default unless ( exists $opts->{$opt} );
   }
}

sub get_option_spec {
   my $mode = shift;
   my $opts = shift;

   my $options = $MODES->{$mode};

   my %spec;
   foreach my $opt ( keys %$options ) {
      my ($modifier) = @{$options->{$opt}};
      $spec{$opt . $modifier} = sub { add_opt($opts, @_) };
   }

   return \%spec;
}

sub mysql_dbh {
   my $args = shift;

   my $database = $args->{'dbname'};
   my $host     = $args->{'host'};
   my $user     = $args->{'user'};
   my $password = $args->{'password'};

   my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",
                          $user,
                          $password,
                          { RaiseError => 1, PrintError => 0 });

   return $dbh;
}


sub sqlite_dbh {
   my $args = shift;

   my $db_file  = $args->{'dbfile'};
   my $user     = $args->{'user'};
   my $password = $args->{'password'};

   my $dbh = DBI->connect("dbi:SQLite:dbname=$db_file",
                          $user,
                          $password,
                          { RaiseError => 1, PrintError => 0 });

   return $dbh;
}

sub oracle_dbh {
    my $args = shift;

    my $user     = $args->{'user'};
    my $password = $args->{'password'};
    my $database = $args->{'db'};


    my $dbh = DBI->connect("dbi:Oracle:$database",
        $user,
        $password,
        { RaiseError => 1, PrintError => 1 });
    return $dbh;
}

sub add_opt {
   my $options  = shift;
   my $arg_name = shift;
   my $value    = shift;

   $options->{$arg_name} = $value;
}

sub usage {
   my $usage = '';
   $usage .= "Database Options\n";

   $usage .= type_usage('main');

   $usage .= "Datbase types:\n";

   foreach my $type ( keys %$DESCRIPTIONS ) {
      my $description = $DESCRIPTIONS->{$type};
      $usage .=  "   $type - $description\n";
   }

   $usage .=  "\n";

   foreach my $type ( keys %$MODES ) {
      next if ( $type eq 'main' );
      $usage .=  "Database Options for type: $type\n";
      $usage .= type_usage($type);
   }

   return $usage;
}

sub type_usage {
   my $type       = shift;
   my $print_mode = shift;

   my $usage = '';

   $usage .= " Usage for --type $type\n" if ( $print_mode );

   my $options = $MODES->{$type};

   foreach my $name ( keys %$options ) {
      my $description = @{$options->{$name}}[2];
      my $default     = @{$options->{$name}}[1];

      $usage .= "   $name  - $description";
      $usage .= " - Default: $default" if ( defined $default && $default ne '' );
      $usage .= "\n";
   }

   $usage .= "\n";

   return $usage;
}

1;
