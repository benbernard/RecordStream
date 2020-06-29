package App::RecordStream::Operation::toprettyprint;

our $VERSION = "4.0.25";

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::OutputStream;
use App::RecordStream::Record;

sub init {
  my $this = shift;
  my $args = shift;

  my $limit = undef;
  my $key_groups  = App::RecordStream::KeyGroups->new();
  my $do_not_nest = 0;
  my $spec = {
    "1"         => sub { $limit = 1; },
    "one"       => sub { $limit = 1; },
    "n=i"       => \$limit,
    'keys|k=s'  => sub { $key_groups->add_groups($_[1]); },
    'nonested'  => \$do_not_nest,
    'aligned:s' => \(my $aligned),
  };

  $this->parse_options($args, $spec);

  if ( ! $key_groups->has_any_group() ) {
    $key_groups->add_groups('!.!returnrefs');
  }

  $this->{'LIMIT'}         = $limit;
  $this->{'KEY_GROUPS'}    = $key_groups;
  $this->{'NESTED_OUTPUT'} = not $do_not_nest;
  $this->{'ALIGNED'}       = $aligned =~ /^l(eft)?$/i ? 'left' : 'right'
    if defined $aligned;
};

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my $limit = $this->{'LIMIT'};
  if ( defined($limit) ) {
    if ( $limit == 0 ) {
      return 0;
    }
    $this->{'LIMIT'}--;
  }

  my $specs = $this->{'KEY_GROUPS'}->get_keyspecs_for_record($record);

  if ($this->{'ALIGNED'}) {
    for my $key (@$specs) {
      my $width = length $key;
      $this->{'FORMAT_KEY_WIDTH'} = $width
        if $width > $this->{'FORMAT_KEY_WIDTH'};
    }
    $this->{'FORMAT_KEY_WIDTH'} *= -1
      if $this->{'ALIGNED'} eq 'left';
  }

  $this->push_line('-' x 70);
  foreach my $key (sort @$specs) {
    my $value = ${$record->guess_key_from_spec($key)};
    $this->output_value('', $key, $value);
  }

  return 1;
}

sub _format_key {
  my $this = shift;
  my $key  = shift;
  return $key unless $this->{'FORMAT_KEY_WIDTH'};
  return sprintf '%*s', $this->{'FORMAT_KEY_WIDTH'}, $key;
}

sub output_value {
  my $this   = shift;
  my $prefix = shift;
  my $key    = shift;
  my $value  = shift;

  $key = $this->_format_key($key);

  if ( (ref($value) eq 'HASH') &&  $this->{'NESTED_OUTPUT'} ) {
    if ( scalar keys %$value > 0 ) {
      $this->push_line($prefix . "$key = HASH:");
      $this->output_hash($prefix . '   ', $value);
    }
    else {
      $this->push_line($prefix . "$key = EMPTY HASH");
    }
  }
  elsif ( ref($value) eq 'ARRAY' ) {
    if ( scalar @$value > 0 ) {
      $this->push_line($prefix . "$key = ARRAY:");
      $this->output_array($prefix . '   ', $value);
    }
    else {
      $this->push_line($prefix . "$key = EMPTY ARRAY");
    }
  }
  else {
    my $value_string = App::RecordStream::OutputStream::hashref_string($value);
    $this->push_line($prefix . "$key = $value_string");
  }
}

sub output_array {
  my $this   = shift;
  my $prefix = shift;
  my $array  = shift;

  my $index = 0;
  foreach my $value (sort @$array) {
    $this->output_value($prefix, $index, $value);
    $index++;
  }
}

sub output_hash {
  my $this   = shift;
  my $prefix = shift;
  my $hash   = shift;

  foreach my $key (sort keys %$hash) {
    my $value = $hash->{$key};
    $this->output_value($prefix, $key, $value);
  }
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('keyspecs');
  $this->use_help_type('keygroups');
  $this->use_help_type('keys');
}

sub usage {
  my $this = shift;

  my $options = [
    ['1|one', 'Only print the first record'],
    ['keys', 'Only print out specified keys, Maybe keyspecs may be keygroups, see --help-keys for more information'],
    ['nonested', 'Do not nest the output of hashes, keep each value on one line'],
    ['n <n>', 'Only print n records'],
    ['aligned [r|l|right|left]', 'Format keys to the same width so values are aligned.  Keys are right aligned by default, but you may pass a value of "left" to left align keys within the width.'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-toprettyprint [files]
   __FORMAT_TEXT__
   Pretty print records, one key to a line, with a line of dashes (---)
   separating records.  Especially useful for records with very large amounts of
   keys
   __FORMAT_TEXT__

Arguments:
$args_string

Examples
  # Pretty print records
  recs-toprettyprint

  # Find all keys with 'time' in the name or value
  ... | recs-toprettyprint --one | grep time
USAGE
}

1;
