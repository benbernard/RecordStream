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
      $this->push_record($record);
    }

  } else {
    my $executor = $this->{'END_EXECUTOR'};

    if ( (defined $executor) && $executor->execute_code($record) ) {
      $this->{'IN_SUBSTREAM'} = 0;
      return 0; # terminate early to avoid reading the rest of the stream
    } else {
      $this->push_record($record);
    }
  }

  return 1;
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('snippet');
}

sub usage {
  return <<USAGE;
Usage: recs-substream <args> [<files>]
  filters to records after the begin predicate is met and before the end predicate is met.
  ie. [begin, end)
  Compare to Perl's bistable "..." range operator.

Arguments:
  --begin <expr> - if omitted, starts at beginning of stream
  --end <expr> - if omitted, continues until end of stream

Examples:
  Filter to a specific minute:
      recs-substream -b '{{EndTime}} =~ /Thu, 07 Nov 2013 22:42/' -e 'not {{EndTime}} =~ /Thu, 07 Nov 2013 22:42/'
  Truncate past a specific date:
      recs-substream -e '{{EndTime}} =~ /Thu, 07 Nov/'
USAGE
}

1;
