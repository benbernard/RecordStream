package Recs::Operation::generate;

use strict;

use base qw(Recs::Operation);

use Recs::Executor;

use Data::Dumper;
use Recs::InputStream;
use Recs::Record;
use Recs::Executor;

sub init {
   my $this = shift;
   my $args = shift;

   my $keychain = '_chain';
   my $passthrough = 0;

   my $spec = {
      'keychain=s'  => \$keychain,
      'passthrough' => \$passthrough,
   };

   $this->parse_options($args, $spec);


   $this->{'KEYCHAIN'}    = $keychain;
   $this->{'PASSTHROUGH'} = $passthrough;

   if ( ! @{$this->_get_extra_args()} ) {
      die "Missing expression\n";
   }

   my $expression      = shift @{$this->_get_extra_args()};
   my $executor        = Recs::Executor->new("qq\000" . $expression . "\000");
   $this->{'EXECUTOR'} = $executor;
}

sub accept_record {
   my $this = shift;
   my $record = shift;

   $this->push_record($record) if $this->{'PASSTHROUGH'};

   my $interpolated_command = $this->{'EXECUTOR'}->execute_code($record);

    if ($@) {
        chomp $@;
        warn "# $0 interpolating command threw: " . $@ . "\n";
        next;
    }

    my $pid = open(my $pipe, "-|", $interpolated_command);

    if (!$pid) {
        warn "# $0 open(..., \"$interpolated_command |\") failed: $!\n";
        next;
    }

    my $generator_stream = Recs::InputStream->new(FH => $pipe);

    while(my $generated_record = $generator_stream->get_record()) {
        ${$generated_record->guess_key_from_spec($this->{'KEYCHAIN'})} = $record->as_hashref();
        $this->push_record($generated_record);
    }
    # Recs::InputStream closes the file handle for us
}

sub usage
{
   my $usage = <<USAGE;
Usage: recs-generate <args> <command> [<files>]

   Executes <command> for each record to generate a record stream, which is
   then output with a chain link back to the original record.

   <command> is executed opened as a command for each record of input (or
   records from <files>) with \$r set to a Recs::Record object. The output
   lines of each command execution are interpreted as a serialized Recs records,
   one per line. Each such line is reconstituted as a Recs::Record, and the
   '_chain' key is added to the record before it is printed. The value of the
   '_chain' key is the record that was originally passed to the eval expression.

   For instance.  If you did:
   recs-generate "recs-fromatomfeed http://...?key=\$r->{title}..."

   with input that looked like:
   { 'title' : 'foo' }
   { 'title' : 'bar' }

   then recs-generate would end up executing:
   recs-fromatomfeed http://...?key=foo...

   and interpreting the result as a series of new line separated records.

   If the result from recs-fromatomfeed was something like:
   { 'title' : 'zip' }
   { 'title' : 'zap' }

   then recs-generate would add the chain link so the output would look like:
   { 'title' : 'zip', 'chain' : { 'title' : 'foo' } }
   { 'title' : 'zap', 'chain' : { 'title' : 'foo' } }

Arguments:
   --passthrough     - Emit input record in addition to generated records
   --keychain <name> - Use 'name' as the chain key (default is '_chain')
                       may be a key spec, see 'man recs' for more
   --help            - Bail and output this help screen.

USAGE

   $usage .= Recs::Executor::usage();

   $usage .=  <<USAGE2;

Examples:

   Chain recs from a feed to recs from a second feed and the print the titles.
      recs-fromatomfeed "http://..." | recs-generate "recs-fromatomfeed http://...?key=\$r->{title}" | recs-eval 'join("\t", \$r->{title}, \$r->{chain}->{title})'
USAGE2

   return $usage;
}

1;
