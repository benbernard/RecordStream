package App::RecordStream::Operation::fromkv;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use strict;
use warnings;

use Getopt::Long;

sub init {
   my $this = shift;
   my $args = shift;

   my $kv_delim     = " ";
   my $entry_delim  = "\n";
   my $record_delim = "END\n";

   my $spec = {
      "kv-delim|f=s"     => \$kv_delim,
      "entry-delim|e=s"  => \$entry_delim,
      "record-delim|r=s" => \$record_delim,
   };

   $this->parse_options($args, $spec);

   $this->{'KV_DELIM'}     = $kv_delim;
   $this->{'ENTRY_DELIM'}  = $entry_delim;
   $this->{'RECORD_DELIM'} = $record_delim;
}


sub wants_input {
   return 0;
}

sub stream_done {
   my $this = shift;

   my $kv_delim     = $this->{'KV_DELIM'};
   my $entry_delim  = $this->{'ENTRY_DELIM'};
   my $record_delim = $this->{'RECORD_DELIM'};

   while (my $line = read_until($record_delim)) {
      {
         local $/ = $record_delim;
         chomp $line;
      }
      $this->update_current_filename($ARGV);

      # trim trailing and leading whitespace from record
      $line =~ s/^\s+|\s+$//g;

      my @entries = split(/\Q$entry_delim\E/, $line);

      if (scalar(@entries) > 0) {
         my $current_record = {};

         for my $entry (@entries) {
            my @pair = split($kv_delim, $entry);

            $current_record->{$pair[0]} = $pair[1] if scalar(@pair) == 2;
         }

         $this->push_record(App::RecordStream::Record->new($current_record));
      }
   }
}

sub read_until {
   my $delim = shift;
   local $/ = $delim;

   return <>;
}

sub usage
{
   my $this = shift;

   my $options = [
      [ 'record-delim|r <delim>', 'Delimiter to for separating records (defaults to "END\\n").'],
      [ 'entry-delim|e  <delim>', 'Delimiter to for separating entries within records (defaults to "\\n").'],
      [ 'kv-delim|f <delim>', 'Delimiter to for separating key/value pairs within an entry (defaults to " ").'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage : recs-fromkv <args> [<files>]
   __FORMAT_TEXT__
   Records are generated from charactr input with the form "<record><record-delim><record>...".
   Records have the form "<entry><entry-delim><entry>...".  Entries are pairs of the form
   "<key><kv-delim><value>".
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
  Parse memcached stat metrics into records
    echo -ne 'stats\\r\\n' | nc -i1 localhost 11211 | tr -d "\\r" | awk '{if (! /END/) {print \$2" "\$3} else {print \$0}}' | recs-fromkv

  Parse records separated by "E\\n" with entries separated by '\|' and pairs separated by '='
    recs-fromkv --kv-delim '=' --entry-delim '\|' --record-delim \$(echo -ne "E\\n")

  Parse records separated by "%\\n" with entries separated by "\\n" and pairs separated by '='
    recs-fromkv --kv-delim '=' --record-delim \$(echo -ne "%\\n")

  Parse records separated by '%' with entries separated by '\|' and pairs separated by '='
    recs-fromkv --kv-delim '=' --entry-delim '\|' --record-delim '%'
USAGE
}

1;
