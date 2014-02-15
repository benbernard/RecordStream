package App::RecordStream::Operation::fromjsonarray;

our $VERSION = "4.0.4";

use strict;
use warnings;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Record;

use JSON;

sub init {
  my ($this, $args) = @_;

  my @fields;
  my $preserve_empty = undef;

  my $spec = {
    'key|k=s'        => sub { push @fields, split(/,/, $_[1]); },
    'preserve-empty' => \$preserve_empty,
  };

  $this->parse_options($args, $spec);

  $this->{'EXTRA_ARGS'}     = $args;
  $this->{'FIELDS'}         = \@fields;
  $this->{'PRESERVE_EMPTY'} = $preserve_empty;
  $this->{'JSON'}           = JSON->new();
}

sub wants_input {
  return 0;
}

sub stream_done {
  my ($this) = @_;

  my $files = $this->{'EXTRA_ARGS'};

  if ( scalar @$files > 0 ) {
    foreach my $file ( @$files ) {
      $this->update_current_filename($file);

      open(my $fh, '<', $file) or die "Could not open file: $!\n";
      $this->get_records_from_handle($fh);
      close $fh;
    }
  }
  else {
    $this->get_records_from_handle(\*STDIN);
  }
}

sub get_records_from_handle {
  my ($this, $fh) = @_;

  my $json = $this->{'JSON'};
  my $fields = $this->{'FIELDS'};
  my $has_fields = scalar @$fields;

  local $/;
  my $contents = <$fh>;

  my $items = $json->decode($contents);

  for my $item (@$items) {
    my $record;

    if ($has_fields) {
      $record = App::RecordStream::Record->new();
      for my $field (@$fields) {
        $record->set($field, $item->{$field}) if exists $item->{$field};
      }
    }
    else {
      $record = App::RecordStream::Record->new($item);
    }

    $this->push_record($record)
      if scalar $record->keys() || $this->{'PRESERVE_EMPTY'};
  }
}

sub usage {
  my ($this) = @_;

  my $options = [
    [ 'key|k <keys>', 'Optional Comma separated list of field names.  If none specified, use all keys.  May be specified multiple times, may be key specs' ],
    [ 'preserve-empty', 'Enable output of empty records' ],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-fromjsonarray <args> [<files>]
   __FORMAT_TEXT__
   Import JSON objects from within a JSON array.
   __FORMAT_TEXT__
Arguments:
$args_string

USAGE
}
