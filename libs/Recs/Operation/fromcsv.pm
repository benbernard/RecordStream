package Recs::Operation::fromcsv;

use strict;

use base qw(Recs::Operation);

use Text::CSV;

sub init {
   my $this = shift;
   my $args = shift;

   my @fields;
   my $header_line = undef;

   my $spec = {
      "field|f=s" => sub { push @fields, split(/,/, $_[1]); },
      "header"    => \$header_line,
   };

   $this->parse_options($args, $spec);

   $this->{'FIELDS'}      = \@fields;
   $this->{'HEADER_LINE'} = $header_line;
   $this->{'PARSER'}      = new Text::CSV();
}

sub run_operation {
   my $this = shift;

   my $parser = $this->{'PARSER'};

   local @ARGV = @{$this->_get_extra_args()};

   if ( $this->{'HEADER_LINE'} ) {
      my $line = <>;
      chomp $line;
      $parser->parse($line);
      push @{$this->{'FIELDS'}}, $parser->fields();
   }

   while(<>)
   {
      chomp;
      my @a = $parser->parse($_);
      @a = $parser->fields();

      my %h;
      for(my $i = 0; $i < @a; ++$i)
      {
         $h{$this->{'FIELDS'}->[$i] || $i} = $a[$i];
      }
      my $r = Recs::Record->new(%h);
      $this->push_record($r);
   }
}

sub usage
{
   return <<USAGE;
Usage: recs-fromcsv <args> [<files>]
   Each line of input (or lines of <files>) is split on csv to
   produce an output record.  Fields are named numerically (0, 1, etc.) or as
   given by --field.

Arguments:
   --field|-f <fields>   Comma separated list of field names.  May be specified multiple times.
   --header              Take field names from the first line of input.
   --help                Bail and output this help screen.

Examples:
   Parse csv separated fields x and y.
      recs-fromcsv --field x,y 
   Parse data with a header line specifying fields
      recs-fromcsv --header
USAGE
}

1;
