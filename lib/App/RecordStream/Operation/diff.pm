package App::RecordStream::Operation::diff;

our $VERSION = "4.0.4";

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::InputStream;
use App::RecordStream::Record;
use Data::Deep ();

sub init {
  my $this = shift;
  my $args = shift;

  my $spec = {
    "as-text|text"  => \($this->{AS_TEXT}),
    "all"           => \($this->{INCLUDE_ALL}),

    "passthru|passthrough=s" => \($this->{PASSTHRU}),

    # XXX TODO: Comparing only a subset of each record's keys.
    # -trs, 11 April 2014
  };

  $this->parse_options($args, $spec);

  # XXX: I wonder if some of this wants to be refactored into a parent
  # "Pairwise" operation class.  Diff would then be a thin wrapper on that, and
  # also implementable in a custom way, e.g.:
  #
  #   recs-pairwise -MData::Deep -e '{{diff}} = compare($a, $b)' a b
  #
  # -trs, 11 April 2014

  my $original = shift @$args
    or die "You must provide an original record stream, or - for stdin\n";

  my $modified = shift @$args
    or die "You must provide a modified record stream, or - for stdin\n";

  die "Only one record stream can be from stdin\n"
    if $original eq "-" and $modified eq "-";

  # Let the normal framework handle stream A, we'll take stream B.
  unshift @$args, $original;
  $this->{STREAM_B} = $this->create_stream($modified);

  if (defined $this->{PASSTHRU}) {
    $this->{PASSTHRU} ||= 'B';
    $this->{PASSTHRU} = uc $this->{PASSTHRU};
  }
}

sub create_stream {
  my $this = shift;
  my $file = shift;
  return App::RecordStream::InputStream->new(
    $file eq "-"
      ? (FH => \*STDIN)
      : (FILE => $file)
  );
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my ($one, $two) = ($record, $this->{STREAM_B}->get_record);

  return 1 if $this->{_STREAM_A_DONE} and not ($one or $two);

  my @diff = Data::Deep::compare(
    map { defined $_ ? $_->as_hashref : $_ }
        $one, $two
  );

  return 1 unless @diff or $this->{INCLUDE_ALL};

  my $output = $this->{AS_TEXT}
      ? Data::Deep::domPatch2TEXT(@diff)
      : \@diff;

  if ($this->{PASSTHRU}) {
    my $output_record = $this->{PASSTHRU} eq 'A' ? $one :
                        $this->{PASSTHRU} eq 'B' ? $two :
                       die "Huh, PASSTHRU not A or B?!" ;

    $output_record ||= App::RecordStream::Record->new({});

    $output_record->set("diff", $output);
    $output = $output_record;
  } else {
    $output = App::RecordStream::Record->new({ diff => $output })
      if ref $output;
  }

  if (ref $output) {
    $this->push_record($output);
  } else {
    $output =~ s/\n/ /g;
    $this->push_line($output);
  }
  return 1;
}

sub stream_done {
  my $this = shift;
  $this->{_STREAM_A_DONE} = 1;
  $this->accept_record(undef) while not $this->{STREAM_B}->is_done;
}

sub usage {
  my $this    = shift;
  my $message = shift;

  my $options = [
    ['as-text|--text', 'Output changes as a textual patches instead of records'],
    ['all', 'Produce output even for records with no changes'],
    ['passthru|--passthrough <A|B>', 'Output the given stream after storing the diff on each record'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
$message
Usage: recs-diff [arguments] <file A> <file B>
   __FORMAT_TEXT__
   Takes two record streams as input, either both from files or one from stdin
   by using "-", and produces a record-by-record description of changes.

   By default each line output is a record containing the key "diff" whose
   value is an array of hashes describing the changes.  Passing --as-text changes
   the output to a formatted string describing the changes.

   Lines are only output for changed records by default.  If this is not suitable,
   pass --all to get a line of output for each pair of input lines.

   To preserve one of the input streams and attach diff information to each
   record before outputting it, specify the --passthru option with a value of "A"
   or "B" indicating the stream to preserve.  Diffs are always generated from
   the perspective of A → B.

   If one input stream has more records than the other, empty records are used
   as the diff source/target.

   This command uses Perl's Data::Deep library to produce diffs.  For complex
   further processing such as applying diffs to other records, see the Data::Deep
   documentation (perldoc Data::Deep).
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
   Diff a records file with a new input stream
      recs-xform '{{index}} = ++\$i' old-records.json | recs-diff --text old-records.json -
USAGE
}

1;
