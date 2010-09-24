package Recs::Operation::eval;

use strict;
use warnings;

use base qw(Recs::Operation Recs::ScreenPrinter);

use Recs::Executor;

sub init {
   my $this = shift;
   my $args = shift;

   $this->parse_options($args);
   if(!@{$this->_get_extra_args()}) {
      die "Missing expression\n";
   }
   my $expression = shift @{$this->_get_extra_args()};
   my $executor = Recs::Executor->new($expression); 
   $this->{'EXECUTOR'} = $executor;
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $executor = $this->{'EXECUTOR'};
   my $value = $executor->execute_code($record);

   return if ( $executor->last_error() );

   $this->print_value($value . "\n");
}

sub usage {
   my $usage =  <<USAGE;
Usage: recs-eval <args> <expr> [<files>]
   <expr> is evaluated as perl on each record of input (or records from
   <files>) with \$r set to a Recs::Record object and \$line set to the current
   line number (starting at 1).  The result of each evaluation is printed on a
   line by itself (this is not a recs stream).  See Recs::Record for help on
   what the \$r object can do.

Arguments:
   --help   Bail and output this help screen.

USAGE

   return $usage . Recs::Executor->usage() . <<EXAMPLES

Examples:
   Print the host field from each record.
      recs-eval '\$r->{host}'
   Prepare to gnuplot field y against field x.
      recs-eval '\$r->{x} . " " . \$r->{y}'
   Set up a script (this would be presumably piped to sh)
      recs-eval '"./myscript --value \$r->{foo}"'

EXAMPLES
}

1;
