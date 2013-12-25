package App::RecordStream::Operation::annotate;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

use App::RecordStream::Executor::Getopt;
use App::RecordStream::Executor;
use App::RecordStream::Record;

sub init {
  my $this = shift;
  my $args = shift;

  my $key_groups  = App::RecordStream::KeyGroups->new();

  my $executor_options = App::RecordStream::Executor::Getopt->new();
  my $spec = {
    $executor_options->arguments(),
    'keys|k=s' => sub { $key_groups->add_groups($_[1]); },
  };

  Getopt::Long::Configure("bundling");
  $this->parse_options($args, $spec);

  my $expression = $executor_options->get_string($args);
  my $executor = App::RecordStream::Executor->new($expression . ';$r');

  if ( ! $key_groups->has_any_group() ) {
    die "Must specify at least one --key, maybe you want recs-xform instead?\n";
  }

  $this->{'EXECUTOR'}    = $executor;
  $this->{'KEYGROUP'}    = $key_groups;
  $this->{'ANNOTATIONS'} = {};
}

sub accept_record {
  my $this   = shift;
  my $record = shift;

  my $specs = $this->{'KEYGROUP'}->get_keyspecs_for_record($record);

  my @values;
  foreach my $key (sort @$specs) {
    my $value = ${$record->guess_key_from_spec($key)};
    push @values, $value;
  }

  # Join keys with the ASCII record separator character (30)
  my $synthetic_key = join(chr(30), @values);

  if ( exists $this->{'ANNOTATIONS'}->{$synthetic_key} ) {
    $this->apply_annotation($synthetic_key, $record);
    $this->push_record($record);
    return 1;
  }

  my $executor = $this->{'EXECUTOR'};

  my $store = {};

  my $hash = create_recorder({$record->as_hash()}, $store);

  my $new_record = App::RecordStream::Record->new($hash);

  my $returned_record = $executor->execute_code($new_record);

  $this->{'ANNOTATIONS'}->{$synthetic_key} = $store;

  $this->push_record($returned_record);

  return 1;
}

sub apply_annotation {
  my $this           = shift;
  my $annotation_key = shift;
  my $record         = shift;

  my $stores = $this->{'ANNOTATIONS'}->{$annotation_key};

  foreach my $keyspec (keys %$stores) {
    my $value = $stores->{$keyspec};
    ${$record->guess_key_from_spec($keyspec)} = $value;
  }
}

sub add_help_types {
  my $this = shift;
  $this->use_help_type('snippet');
  $this->use_help_type('keyspecs');
  $this->use_help_type('keygroups');
  $this->use_help_type('keys');
}

sub usage {
  my $this = shift;

  my $options = [
    App::RecordStream::Executor::options_help(),
    ['keys', 'Keys to match records by, maybe specified multiple times, may be a keygroup or keyspec'],
  ];

  my $args_string = $this->options_string($options);

  return <<USAGE;
Usage: recs-annotate <args> <expr> [<files>]
   __FORMAT_TEXT__
   <expr> is evaluated as perl on each record of input (or records from
   <files>) with \$r set to a App::RecordStream::Record object and \$line set
   to the current line number (starting at 1).  Records are analyzed for
   changes, those changes are applied to each successive record that matches
   --keys

   Only use this script if you have --keys fields that are repeated, otherwise
   recs-xform will be faster
   __FORMAT_TEXT__

IMPORTANT SNIPPET NOTE
   __FORMAT_TEXT__
   Because of the way annotations are recorded, you cannot use UNSHIFT or
   SPLICE on array refs that already exist in the record you are modifiying.
   Additinally, deletes, removes, unshifts, and other 'removing' operations
   will not apply to later records.  If you need this behavior, consider using
   recs-xform
   __FORMAT_TEXT__

$args_string

Examples:
   # Annotate records with IPs with hostnames, only doing lookup once
   ... | recs-annotate --key ip '{{hostname}} = `host {{ip}}`'

   # Record md5sums of files
   ... | recs-annotate --key filename '{{md5}} = `md5sum {{filename}}`'

   # Add url contents to records
   ... | recs-annotate --key url '{{contents}} = `curl {{url}}`'
USAGE
}

sub create_recorder {
  my $data            = shift;
  my $store           = shift;
  my $current_keyspec = shift;

  #Nothing todo, what happened here?
  if ( ref($data) ne 'HASH' && ref($data) ne 'ARRAY' ) {
    warn "create_recorder called on non HASH or ARRAY data!\n";
    return $data;
  }

  my $recorder = KeyspecRecorder->new($current_keyspec, $store);

  my $spec = '';
  if ( defined $current_keyspec ) {
    $spec = $current_keyspec . '/';
  } 

  if ( ref($data) eq 'HASH' ) {
    my %new_hash;
    foreach my $key (keys %$data) {
      my $value = $data->{$key};
      my $new_value = $value;
      if ( ref($value) eq 'HASH' || ref($value) eq 'ARRAY' ) {
        my $new_data = create_recorder($value, $store, $spec . $key);
        $new_value = $new_data;
      }
      $new_hash{$key} = $new_value;
    }

    my %hash;
    my $recorder = tie %hash, 'RecordingHash', \%new_hash, $recorder;

    return \%hash;
  }
  else { #Must be an array
    my @new_array;
    my $index = 0;
    foreach my $value (@$data) {
      my $new_value = $value;
      if ( ref($value) eq 'HASH' || ref($value) eq 'ARRAY' ) {
        my $new_data = create_recorder($value, $store, $spec . '#' . $index);
        $new_value = $new_data;
      }

      push @new_array, $new_value;
      $index++;
    }

    my @array;
    my $recorder = tie @array, 'RecordingArray', \@new_array, $recorder;

    return \@array;
  }

}


1;

package KeyspecRecorder;

sub new {
  my $class           = shift;
  my $current_keyspec = shift;
  my $store           = shift;

  my $this = bless {
    KEYSPEC => $current_keyspec,
    STORES  => $store,
  }, $class;

  return $this;
}

sub get_stores {
  my $this = shift;
  return $this->{'STORES'};
}

sub get_keyspec {
  my $this = shift;
  return $this->{'KEYSPEC'};
}

sub add_store {
  my $this      = shift;
  my $sub_spec  = shift;
  my $value     = shift;

  my $spec = $sub_spec;
  if ( defined $this->get_keyspec() ) {
    $spec = $this->get_keyspec() . '/' . $sub_spec;
  }

  $this->get_stores()->{$spec} = $value;
}

1;

package RecordingHash;

use Tie::Hash;
use base qw(Tie::ExtraHash);

sub TIEHASH {
  my $class           = shift;
  my $hash            = shift;
  my $recorder        = shift;

  my $this = bless [ $hash, $recorder ], $class;
  return $this;
}

sub STORE {
  my ($this, $key, $value) = @_;
  my ($hash, $data) = @$this;
  $hash->{$key} = $value;
  $this->get_recorder()->add_store($key, $value);
}

sub get_recorder {
  return $_[0]->[1];
}

package RecordingArray;

use Tie::Array;
use base qw(Tie::Array);

#sub TIEARRAY  { bless [], $_[0] }
sub TIEARRAY {
  my $class           = shift;
  my $array           = shift;
  my $recorder        = shift;

  my $this = bless [ $array, $recorder ], $class;
  return $this;
}

#sub STORE     { $_[0]->[$_[1]] = $_[2] }
sub STORE { my ($this, $index, $value) = @_; my ($array, $recorder) = @$this;
  $array->[$index] = $value;
  $this->get_recorder()->add_store('#' . $index, $value);
}

sub PUSH { 
  my ($this, @new_items) = @_;
  my ($array, $recorder) = @$this;
  my $start_index = scalar @$array;

  #First modify the array
  push @$array, @new_items;

  #Now record the new indexes
  my $num_to_push = scalar @new_items;
  my $item_index = 0;

  foreach my $index ($start_index..($start_index+$num_to_push-1)) {
    $recorder->add_store('#' . $index, $new_items[$item_index]);
    $item_index++;
  }
}

# These methods are copied from Tie::StdArray, Except modified to work on the
# first array, like ExtraHash (there is no ExtraArray)
sub FETCHSIZE { scalar @{$_[0]->[0]} }
sub STORESIZE { $#{$_[0]->[0]} = $_[1]-1 }
sub FETCH     { $_[0]->[0]->[$_[1]] }
sub CLEAR     { @{$_[0]->[0]} = () }
sub POP       { pop(@{$_[0]->[0]}) }
sub SHIFT     { shift(@{$_[0]->[0]}) }
sub EXISTS    { exists $_[0]->[0]->[$_[1]] }
sub DELETE    { delete $_[0]->[0]->[$_[1]] }

# Die on unsupported methods
sub UNSHIFT   { die "UNSHIFT Unsupported in annotate, consider using xform" }
sub SPLICE { die "SPLICE Unsupported in annotate, consider using xform" }

sub get_recorder {
  return $_[0][1];
}

1;
