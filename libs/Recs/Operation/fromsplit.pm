package Recs::Operation::fromsplit;

use strict;

use base qw(Recs::Operation);

sub init {
   my $this = shift;
   my $args = shift;

   my $headers = 0;
   my %options = (
      "delim|d=s" => sub { $this->_set_delimiter($_[1]); },
      "field|f=s" => sub { $this->add_field(split(/,/, $_[1])); },
      "header"    => \$headers,
   );

   $this->parse_options($args, \%options);

   $this->{'HEADER'} = $headers;
}

sub _set_delimiter {
   my ($this, $value) = @_;
   $this->{'DELIMITER'} = $value;
}

sub get_delimiter {
   my ($this) = @_;
   if(!defined($this->{'DELIMITER'})) {
      return ',';
   }
   return $this->{'DELIMITER'};
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


   if ($this->{'HEADER'}) {
      my $line = <>;
      chomp $line;
      my $delim = $this->get_delimiter();
      $this->add_field($_) for split2($this->get_delimiter(), $line);
   }

   while(my $line = <>) {
      chomp $line;

      my $record = Recs::Record->new();
      my $index = 0;

      foreach my $value (split2($this->get_delimiter(), $line)) {
         ${$record->guess_key_from_spec($this->get_field($index))} = $value;
         ++$index;
      }

      $this->push_record($record);
   }
}

sub split2 {
   my ($delimiter, $string) = @_;

   my @sub_strings;

   my $index;
   my $start = 0;
   while(($index = index($string, $delimiter, $start)) != -1) {
      push @sub_strings, substr($string, $start, $index - $start);
      $start = $index + length($delimiter);
   }
   push @sub_strings, substr($string, $start);

   return @sub_strings;
}

sub usage {
   return <<USAGE;
Usage: recs-fromsplit <args> [<files>]
   Each line of input (or lines of <files>) is split on provided delimiter to
   produce an output record.  Fields are named numerically (0, 1, etc.) or as
   given by --field.

Arguments:
   --delim|-d <delim>    Delimiter to use for splitting input lines (default ',').
   --field|-f <fields>   Comma separated list of field names.  May be specified multiple times.
   --header              Take field names from the first line of input.
   --help                Bail and output this help screen.

Examples:
   Parse space separated fields x and y.
      recs-fromsplit --field x,y --delim ' '
   Parse comma separated fields a, b, and c.
      recs-fromsplit --field a,b,c
USAGE
}

1;
