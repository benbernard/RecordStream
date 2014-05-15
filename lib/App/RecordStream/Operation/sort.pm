package App::RecordStream::Operation::sort;

our $VERSION = "4.0.14";

use strict;
use warnings;

use base qw(App::RecordStream::Accumulator App::RecordStream::Operation);

sub init {
  my $this = shift;
  my $args = shift;

  my @keys;
  my $reverse;
  my $rank;
  my $percentile;

  my $spec = {
    "key|k=s"        => sub { push @keys, split(/,/, $_[1]); },
    "reverse|r"      => \$reverse,
    "rank|R=s"       => \$rank,
    "percentile|p=s" => \$percentile,
  };

  $this->parse_options($args, $spec);

  $this->{'KEYS'}       = \@keys;
  $this->{'REVERSE'}    = $reverse;
  $this->{'RANK'}       = $rank;
  $this->{'PERCENTILE'} = $percentile;
}

sub stream_done {
  my $this = shift;

  my @records = App::RecordStream::Record::sort($this->get_records(), @{$this->{'KEYS'}});

  if ( $this->{'REVERSE'} ) {
    @records = reverse @records;
  }

  for(my $i = 0; $i < @records; ++$i) {
    my $record = $records[$i];
    if ( defined($this->{'RANK'}) ) {
      ${$record->guess_key_from_spec($this->{'RANK'})} = $i;
    }
    if ( defined($this->{'PERCENTILE'}) ) {
      ${$record->guess_key_from_spec($this->{'PERCENTILE'})} = $i / @records;
    }
    $this->push_record($record);
  }
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('keyspecs');
}

sub usage {
  my $this = shift;

  my $options = [
    ['key <keyspec>', "May be comma separated, May be specified multiple times.  Each keyspec is a name or a name=sortType.  The name should be a field name to sort on.  The sort type should be either lexical or numeric.  Default sort type is lexical (can also use nat, lex, n, and l).  Additionallly, the sort type may be prefixed with '-' to indicate a decreasing sort order.  Additionally, the sort type may be postfixed with '*' to sort the special value 'ALL' to the end (useful for the output of recs-collate --cube).  See perldoc for App::RecordStream::Record for more on sort specs.  May be a key spec, see '--help-keyspecs' for more.  Cannot be a keygroup."],
    ['reverse', 'Reverses the sort order'],
    ['rank|-R <field>', 'Save the rank of each record in this field (0-indexed).'].
    ['percentile <field>', 'Save the percentile of each record in this field (calculated as rank divided by record count).'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-sort <args> [<files>]
   __FORMAT_TEXT__
   Sorts records from input or from <files>.  You may sort on a list of keys,
   each key sorted lexically (alpha order) or numerically
   __FORMAT_TEXT__

$args_string

Examples:
   Sort on the id field, a numeric
      recs-sort --key id=numeric
   Sort on age, then name
      recs-sort --key age=numeric,name
   Sort on decreasing size, name
      recs-sort --key size=-numeric --key name
   Compute ranks and percentiles for each student within their classroom
      recs-multiplex -k classroom -- recs-sort -k grade=num -R rank -p percentile
USAGE
}

1;
