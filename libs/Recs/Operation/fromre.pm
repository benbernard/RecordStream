package Recs::Operation::fromre;

use strict;

use base qw(Recs::Operation);

sub init {
   my $this = shift;
   my $args = shift;

   my %options = (
      "field|f=s" => sub { $this->add_field(split(/,/, $_[1])); },
   );

   $this->parse_options($args, \%options);
   if(!@{$this->_get_extra_args()}) {
      die "Missing expression\n";
   }
   $this->_set_pattern(shift @{$this->_get_extra_args()});
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

sub run_operation {
   my ($this) = @_;

   local @ARGV = @{$this->_get_extra_args()};
   while(my $line = <>) {
      chomp $line;

      if(my @groups = ($line =~ $this->get_pattern())) {
         my $record = Recs::Record->new();
         my $index = 0;

         foreach my $value (@groups) {
            ${$record->guess_key_from_spec($this->get_field($index))} =  $value;
            ++$index;
         }

         $this->push_record($record);
      }
   }
}

sub usage {
   return <<USAGE;
Usage: recs-fromre <args> <re> [<files>]
   <re> is matched against each line of input (or lines of <files>).  Each
   successfully match results in one output record whose field values are the
   capture groups from the match.  Lines that do not match are ignored.  Fields
   are named numerically (0, 1, etc.) or as given by --field.

   For spliting on a delimeter, see recs-fromsplit.

Arguments:
   --field|-f <fields>   Comma separated list of field names.  May be specified multiple times.
                         may be a key spec, see 'man recs' for more
   --help                Bail and output this help screen.

Examples:
   Parse greetings.
      recs-fromre --field name,age '^Hello, my name is (.*) and I am (\\d*) years? old\$'
   Parse a single field named time from a group of digits at the beginning of the line.
      recs-fromre --field time '^(\\d+)'
   Map three sets of <>s to a record with fields named 0, 1, and 2
      recs-fromre '<(.*)>\\s*<(.*)>\\s*<(.*)>'
USAGE
}

1;
