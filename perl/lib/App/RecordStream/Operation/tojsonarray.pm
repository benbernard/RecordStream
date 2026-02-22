use strict;
use warnings;
use utf8;

package App::RecordStream::Operation::tojsonarray;
use base qw(App::RecordStream::Operation);

sub init {
  my $this = shift;
  my $args = shift;
  $this->parse_options($args);
  $this->{COUNT} = 0;
}

sub accept_line {
  my $this = shift;
  my $line = shift;
  $this->push_line(
    $this->{COUNT}++ == 0
      ? "[$line"
      : ",$line"
  );
  return 1;
}

sub stream_done {
  my $this = shift;
  $this->push_line(
    $this->{COUNT}
      ? "]"
      : "[]"
  );
}

sub usage {
  my $this = shift;
  return <<USAGE;
Usage: recs tojsonarray [files]
   __FORMAT_TEXT__
   This command outputs the record stream as a single JSON array.  It
   complements the fromjsonarray command.
   __FORMAT_TEXT__

Examples
  # Save the record stream to a file suitable for loading by any JSON parser
  ... | recs tojsonarray > recs.json
USAGE
}

1;
