package Recs::Operation::grep;

use strict;

use base qw(Recs::Operation);

use Recs::Executor;

sub init {
   my $this = shift;
   my $args = shift;

   my $anti_match;
   my $spec = {
      "-v" => \$anti_match,
   };

   $this->parse_options($args, $spec);

   if ( ! @{$this->_get_extra_args()} ) {
      die "Missing expression\n";
   }

   $this->{'ANTI_MATCH'} = $anti_match;

   my $expression = shift @{$this->_get_extra_args()};
   my $executor = Recs::Executor->new($expression); 
   $this->{'EXECUTOR'} = $executor;
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $executor = $this->{'EXECUTOR'};
   my $result = $executor->execute_code($record);

   $result = not $result if ( $this->{'ANTI_MATCH'} );

   if ( $result && ! $executor->last_error() ) {
     $this->push_record($record);
     $this->{'SEEN_RECORD'} = 1;
   }
}

sub stream_done {
   my $this = shift;
   $this->_set_exit_value(1) unless ( $this->{'SEEN_RECORD'} );
}

sub usage {
   my $usage =  <<USAGE;
Usage: recs-grep <args> <expr> [<files>]
   <expr> is evaluated as perl on each record of input (or records from
   <files>) with \$r set to a Recs::Record object and \$line set to the current
   line number (starting at 1).  Records for which the evaluation is a perl
   true are printed back out.

Arguments:
   -v       Anti-match.  Records NOT matching <expr> will be returned
   --help   Bail and output this help screen.

USAGE

   return $usage . Recs::Executor->usage() . <<EXAMPLES

Examples:
   Filter to records with field 'name' equal to 'John'
      recs-grep '\$r->{name} eq "John"'
   Find fields without ppid = 3456
     recs-grep -v '{{ppid}} == 3456'
EXAMPLES
}

1;
