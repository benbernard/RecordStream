package App::RecordStream::KeySpec;

=head1 NAME

App::RecordStream::KeySpec

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

This class knows out to look up a keyspec in a datastructure

=head1 SYNOPSIS

    use App::RecordStream::KeySpec;
    my $data_ref = App::RecordStream::KeySpec::find_key($r, 'Foo/Bar');

=cut

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::KeySpec;

use Data::Dumper;

my $registry = {};

sub find_key {
  my ($data, $spec, $no_vivify, $throw_error) = @_;

  my $spec_obj = __PACKAGE__->new($spec);
  return $spec_obj->guess_key($data, $no_vivify, $throw_error);
}

sub new
{
  my $class = shift;
  my $spec  = shift;

  if ( exists $registry->{$spec} ) {
    return $registry->{$spec};
  }

  my $this = {
    SPEC => $spec,
  };

  bless $this, $class;
  $this->init();

  $registry->{$spec} = $this;
  return $this;
}

sub init
{
  my $this = shift;
  $this->_parse_key_spec();
}

{
  my $guessed_keys = {};

  sub _search_string_to_key {
    my $key_chain = shift;
    my $string    = shift;

    return $guessed_keys->{join('-', @$key_chain)}->{$string};
  }

  sub _add_string_key_mapping {
    my $key_chain = shift;
    my $string    = shift;
    my $key       = shift;

    $guessed_keys->{join('-', @$key_chain)}->{$string} = $key;
  }
}

sub _guess_key_name_raw {
  my ($this, $data, $key_chain, $search_string) = @_;

  my $fuzzy = $this->{'FUZZY'};

  if ( UNIVERSAL::isa($data, 'ARRAY') ) {
    if ( $search_string =~ m/^#(\d+)$/ ) {
      return $1;
    }
    else {
      die "Cannot select non-numeric index: $search_string (did you forget to prefix with a '#'?) for array: " . Dumper($data);
    }
  }

  return $search_string if ( ! $fuzzy );

  my $found_key;

  if ( my $key = _search_string_to_key($key_chain, $search_string) ) {
    return $key;
  }

  # First check exact match
  if ( defined $data->{$search_string} ) {
    $found_key = $search_string;
  }
  else {
    # Next check prefixes, no interpolation
    foreach my $key ( CORE::sort(CORE::keys %$data) ) {
      if ( $key =~ m/^\Q$search_string\E/i ) {
        $found_key = $key;
      }
    }
  }

  if ( !$found_key ) {
    # Check for match anywhere in the keys, allow regex interpolation
    foreach my $key ( CORE::sort(CORE::keys %$data) ) {
      if ( $key =~ m/$search_string/i ) {
        $found_key = $key;
      }
    }
  }

  if ( !$found_key ) {
    $found_key = $search_string;
  }

  _add_string_key_mapping($key_chain, $search_string, $found_key);

  return $found_key
}

sub has_key_spec {
  my ($this, $data) = @_;
  eval { $this->guess_key($data, 0, 1) };

  if ( $@ =~ m/^NoSuchKey/ ) {
    return 0;
  }
  elsif ( $@ ) {
    #Rethrow if a different error
    die $@;
  }

  return 1;
}

sub get_key_list_for_spec {
  my ($this, $data) = @_;

  return $this->_guess_key_recurse(
    $data,
    [],
    1,
    0,
    1,
    @{$this->{'PARSED_KEYS'}},
  );
}

sub _parse_key_spec {
  my ($this) = @_;

  my $spec      = $this->{'SPEC'};
  my $fuzzy     = 0;
  my $spec_name = $spec;

  if ( substr($spec, 0, 1) eq '@' ) {
    $fuzzy = 1;
    $spec = substr($spec, 1);
  }

  my $keys = [];
  my $current_key = '';
  my $last_char = '';

  for (my $index = 0; $index < length($spec); $index++) {
    my $current_char = substr($spec, $index, 1);

    if ( $current_char eq '/' && $last_char ne '\\' ) {
      push @$keys, $current_key;
      $current_key = '';
      $last_char   = '';
      next;
    }
    else {
      if ( $current_char eq '/' ) {
        chop $current_key;
      }

      $current_key .= $current_char;
      $last_char    = $current_char;
      next;
    }
  }

  if ( $current_key ne '' ) {
    push @$keys, $current_key;
  }

  $this->{'PARSED_KEYS'} = $keys;
  $this->{'FUZZY'} = $fuzzy;
}

{
  my $keylookup_hash = {};

  sub guess_key {
    my ($this, $data, $no_vivify, $throw_error) = @_;

    my @args = @{$this->{'PARSED_KEYS'}};

    $no_vivify   ||= 0;
    $throw_error ||= 0;
    my $args_string = join('-', @args, $no_vivify, $throw_error);

    if ( my $code = $keylookup_hash->{$args_string} ) {
      return $code->($data);
    }

    my $keys = $this->_guess_key_recurse(
      $data,
      [],
      $no_vivify,
      $throw_error,
      1,
      @args,
    );

    my $code = $this->_generate_keylookup_sub($keys, $no_vivify);
    $keylookup_hash->{$args_string} = $code;

    return $code->($data);
  }
}

# Performance! Oh god, performance.  Generate a lookup subroutine that will
# lookup the passed keys, for execution later
sub _generate_keylookup_sub {
  my $this        = shift;
  my $keys        = shift;
  my $no_vivify   = shift;
  my $throw_error = shift;

  if ( scalar @$keys  == 0 ) {
    return eval 'sub { if ( \$throw_error ) { die "NoSuchKey"; } return ""; }';
  }

  my $code_string = 'sub { my $record = shift;';

  my $key_accessor = '$record';

  my $action = "return ''";
  $action = "die 'NoSuchKey'" if ( $throw_error );

  my $check_actions = '';

  foreach my $key (@$keys) {
    if ( $key =~ m/^#(\d+)$/ ) {
      my $index = $1;
      $key_accessor .= "->[$index]";
    }
    else {
      my @hex_bytes = unpack('C*', $key);
      my $hex_string = '';

      foreach my $byte (@hex_bytes) {
        $hex_string .= "\\x" . sprintf ("%lx", $byte);
      }

      $key_accessor .= "->{\"$hex_string\"}";
    }

    $check_actions  .= "$action if ( ! exists $key_accessor );";
  }

  if ( $no_vivify || $throw_error ) {
    $code_string .= $check_actions;
  }

  $code_string .= "return \\($key_accessor)}";

  my $sub_ref = eval $code_string;
  if ( $@ ) {
    warn "Unexpected error in creating key lookup!\n";
    die $@;
  }
  return $sub_ref;
}

sub _guess_key_recurse {
  my ($this, $data, $key_chain, $no_vivify, $throw_error,
    $return_key_chain, $search_string, @next_strings)  = @_;

  my $type = ref($data);

  if ( $type eq 'SCALAR' || UNIVERSAL::isa(\$data, 'SCALAR') ) {
    die "Cannot look for $search_string in scalar: " . Dumper($data);
  }

  my $key = $this->_guess_key_name_raw($data, $key_chain, $search_string);

  my $value;

  if ( $type eq 'ARRAY' ) {
    $value = \($data->[$key]);
    $key = "#$key";
  }
  else {
    if ( $no_vivify && (!exists $data->{$key}) ) {
      return $return_key_chain ? [] : '';
    }

    $value = \($data->{$key})
  }

  if ( scalar @next_strings > 0 ) {
    if ( ! defined $$value ) {
      die "NoSuchKey" if ( $throw_error );

      if ( $no_vivify ) {
        return $return_key_chain ? [] : '';
      }

      if ( substr($next_strings[0], 0, 1) eq '#' ) {
        $$value = [];
      }
      else {
        $$value = {};
      }
    }

    return $this->_guess_key_recurse(
      $$value,
      [@$key_chain, $key],
      $no_vivify,
      $throw_error,
      $return_key_chain,
      @next_strings,
    );
  }

  return $return_key_chain ? [@$key_chain, $key] : $value;
}

sub keyspec_help {
  return <<KEYSPECS_HELP;
  KEY SPECS
   __FORMAT_TEXT__
   A key spec is short way of specifying a field with prefixes or regular
   expressions, it may also be nested into hashes and arrays.  Use a '/' to nest
   into a hash and a '#NUM' to index into an array (i.e. #2)

   An example is in order, take a record like this:
   __FORMAT_TEXT__

     {"biz":["a","b","c"],"foo":{"bar 1":1},"zap":"blah1"}
     {"biz":["a","b","c"],"foo":{"bar 1":2},"zap":"blah2"}
     {"biz":["a","b","c"],"foo":{"bar 1":3},"zap":"blah3"}

   __FORMAT_TEXT__
   In this case a key spec of 'foo/bar 1' would have the values 1,2, and 3
   in the respective records.

   Similarly, 'biz/#0' would have the value of 'a' for all 3 records

   You can also prefix key specs with '\@' to engage the fuzzy matching logic
   __FORMAT_TEXT__

   __FORMAT_TEXT__
   Fuzzy matching works like this in order, first key to match wins
   __FORMAT_TEXT__
     1. Exact match ( eq )
     2. Prefix match ( m/^/ )
     3. Match anywehre in the key (m//)

   __FORMAT_TEXT__
   So, in the above example '\@b/#2', the 'b' portion would expand to 'biz' and 2
   would be the index into the array, so all records would have the value of 'c'

   Simiarly, \@f/b would have values 1, 2, and 3

   You can escape / with a \\.  For example, if you have a record:
   __FORMAT_TEXT__
   {"foo/bar":2}

   __FORMAT_TEXT__
   You can address that key with foo\\/bar
   __FORMAT_TEXT__
KEYSPECS_HELP
}

1;
