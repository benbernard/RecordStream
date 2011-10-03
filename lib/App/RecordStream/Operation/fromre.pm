package App::RecordStream::Operation::fromre;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

sub init {
   my $this = shift;
   my $args = shift;

   my %options = (
      "key|k|field|f=s" => sub { $this->add_field(split(/,/, $_[1])); },
   );

   $this->parse_options($args, \%options);
   if(!@$args) {
      die "Missing expression\n";
   }
   $this->_set_pattern(shift @$args);
}

sub _set_pattern {
   my ($this, $value) = @_;
   $this->{'PATTERN'} = $value;
}

sub get_pattern {
   my ($this) = @_;
   return $this->{'PATTERN'} || 0;
}

sub add_field {
   my $this = shift;
   $this->{'FIELDS'} ||= [];
   push @{$this->{'FIELDS'}}, @_;
}

sub get_field {
   my ($this, $index) = @_;

   if($this->{'FIELDS'} && $index < @{$this->{'FIELDS'}}) {
      return $this->{'FIELDS'}->[$index];
   }
   else {
      return $index;
   }
}

sub accept_line {
   my $this = shift;
   my $line = shift;

   if(my @groups = ($line =~ $this->get_pattern())) {
      my $record = App::RecordStream::Record->new();
      my $index = 0;

      foreach my $value (@groups) {
         ${$record->guess_key_from_spec($this->get_field($index))} =  $value;
         ++$index;
      }

      $this->push_record($record);
   }

   return 1;
}

sub add_help_types {
   my $this = shift;
   $this->use_help_type('keyspecs');
}

sub usage {
   my $this = shift;

   my $options = [
      [ 'key|-k <key>', 'Comma separated list of key names.  May be specified multiple times. may be a key spec, see \'man recs\' for more'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-fromre <args> <re> [<files>]
   __FORMAT_TEXT__
   <re> is matched against each line of input (or lines of <files>).  Each
   successfully match results in one output record whose field values are the
   capture groups from the match.  Lines that do not match are ignored.  Keys
   are named numerically (0, 1, etc.) or as given by --key.

   For spliting on a delimeter, see recs-fromsplit.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Parse greetings
      recs-fromre --key name,age '^Hello, my name is (.*) and I am (\\d*) years? old\$'
   Parse a single key named time from a group of digits at the beginning of the line
      recs-fromre --key time '^(\\d+)'
   Map three sets of <>s to a record with keys named 0, 1, and 2
      recs-fromre '<(.*)>\\s*<(.*)>\\s*<(.*)>'
USAGE
}

1;
