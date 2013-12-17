package App::RecordStream::Operation::substream;

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Executor;

sub init {
  my $this = shift;
  my $args = shift;

  my $begin;
  my $end;

  my $spec = {
    "begin|b=s" => \$begin,
    "end|e=s"   => \$end,
  };

  $this->parse_options($args, $spec);

  $this->{'BEGIN_EXECUTOR'} = App::RecordStream::Executor->new($begin) if defined $begin;
  $this->{'END_EXECUTOR'}   = App::RecordStream::Executor->new($end)   if defined $end;
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  if ( ! $this->{'IN_SUBSTREAM'} ) {
    my $executor = $this->{'BEGIN_EXECUTOR'};

    if ( (! defined $executor) || $executor->execute_code($record) ) {
      $this->{'IN_SUBSTREAM'} = 1;
    }
  }

  if ( $this->{'IN_SUBSTREAM'} ) {
    my $executor = $this->{'END_EXECUTOR'};

    $this->push_record($record);
    $this->{'SEEN_RECORD'} = 1;

    if ( (defined $executor) && $executor->execute_code($record) ) {
      $this->{'IN_SUBSTREAM'} = 0;
      return 0; # terminate early to avoid reading the rest of the stream
    }
  }

  return 1;
}

sub stream_done {
  my $this = shift;
  $this->_set_exit_value(1) unless ( $this->{'SEEN_RECORD'} );
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('snippet');
}

sub usage {
  my $this = shift;

  my $options = [
    ['begin|b SNIP ', 'Begins outputting records when this snippet becomes true. If omitted, output starts from beginning of the stream.'],
    ['end|e SNIP', 'Stops outputting records after this snippet becomes true. If omitted, outputs to the end of the stream.'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-substream <args> [<files>]
   __FORMAT_TEXT__
  Filters to a range of records delimited from when the begin snippet becomes true to when the end snippet becomes true, ie. [begin, end]. Compare to Perl's inclusive, bistable ".." range operator.

  See --help-snippet for details on snippets.
   __FORMAT_TEXT__

Arguments:
$args_string

Examples:
  Filter to a specific minute:
      recs-substream -b '{{EndTime}} =~ /Thu, 07 Nov 2013 22:42/' -e 'not {{EndTime}} =~ /Thu, 07 Nov 2013 22:42/'
  Truncate past a specific date:
      recs-substream -e '{{EndTime}} =~ /Thu, 07 Nov/'
USAGE
}

1;
