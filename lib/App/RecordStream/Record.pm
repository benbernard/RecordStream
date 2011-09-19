package App::RecordStream::Record;

=head1 NAME

App::RecordStream::Record

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

An object representing a single record of recs input/output.  This is a
glorified hash with some helper methods.

=head1 SYNOPSIS

    use App::RecordStream::Record;
    my $record = App::RecordStream::Record->new("name" => "John Smith", "age" => 39);

=head1 CONSTRUCTOR

=over 4

=item App::RecordStream::Record->new(%hash);

Construct a new record with provided keys and values.  Can take a single
argument which is a hash ref.  If this form is used, it will bless that hash
and use it, so that hash ref now belongs to this object.  This avoids memory
copies

=back

=head1 METHODS

=over 4

=item @keys = $this->keys();

Returns an array of field names.

=item $boolean = $this->exists($key);

Determine whether or not this field exists in the record.

=item $value = $this->get($key);

Retrieve a field from the record, returns undef if there is no such field.

=item $old_value = $this->get_XXX();

Calls $this->get("XXX");

=item $old_value = $this->set($key, $value);

Set a field in the record, returns the old value, or undef if there was no such
field.

=item $old_value = $this->set_XXX($value);

Calls $this->set("XXX", $value);

=item @old_values = $this->remove(@keys);

Remove fields from the record, returns the old values (or undef for each missing).

=item $this->prune_to(@keys);

Removes fields whose names are not among those provided.

=item $this->rename($old_key, $new_key);

Rename a field.  If the field did not exists a new field with value undef is
created.

=item %hash = $this->as_hash();

Marshall a record into hash format.

=item $hashref = $this->as_hashref();

Marshall a record into hash format, returning a reference.  The caller may
modify this hash (the changes will not be reflected in the record itself).

=item $cmp = $this->cmp($that, @keys);

Compare this record to another, using comparators derived from @keys (see
get_comparators).  Returns -1, 0, or 1 for $this before $that, $this same as
$that, and $this after $that, respectively.

=item $value_ref = $this->guess_key_from_spec($keyspec, $no_vivify = 0, $throw_error = 0)

Get the reference for a key spec.  Commonly used like:

${$r->guess_key_from_spec('foo/bar')} eq 'zip'
${$r->guess_key_from_spec('foo/bar')} = 'boo'

(the assign back gets back into the record)

no_vivify and no_error are optional, and control behavior in the absence of the
specified key.  throw_error will cause a 'NoSuchKey' exception to be thrown.

See 'man recs' for more info on key specs

=item $boolean = $this->has_key_spec($spec)

Returns a boolean indicating the presence of the key spec in the record.  Will
not have side effects in the record.

=item $ARRAY_REF = $this->get_key_list_for_spec($spec)

Returns a list of keys that the spec expanded out to.  Arrrays will still be
#NUM, hash keys will be fully expanded to the keys present in the record.

=item $keyspecs_array_ref = $this->get_keys_for_group($key_group, $rerun)

Will create a App::RecordStream::KeyGroups (if necessary) and return the keyspecs that match
the given group.  See --help-keyspecs or App::RecordStream::KeyGroups for more information.

Setting rerun to true will cause every record this is called on to re-do
keygroup calculation

=item $values_array_ref = $this->get_group_values($key_group, $rerun)

Returns the values in this record for a key group.  Will rerun keygroup parsing
if $rerun is passed

=item $comparators_ref = App::RecordStream::Record::get_comparators(@specs)

Calls get_comparator for each element of @specs and returns the results
together in an array reference.

=item $comparator = App::RecordStream::Record::get_comparator($spec)

Produces a comparator function (which takes two records and returns similarly
to <=> or cmp) from the provided $spec.  $spec should be like "<field>" for
lexical sort, or "<field>=<sign><type><star>" where <sign> is "+" or "" for
ascending or "-" for descending and type is one of the known types and <star>
is "*" for sorting "ALL" to the end or "" for normal behaviour.  Type include
"", "l", "lex", or "lexical" for lexical sort (using cmp), and "n", "num" or
"numeric" for numeric sort (using <=>).

=item @sorted_records = App::RecordStream::Record::sort($records_ref, @specs)

Sorts an array ref of records using the provided specs, returns an array of
records.

=back

=cut

our $VERSION = "3.4";

use strict;
use warnings;

use App::RecordStream::KeyGroups;

use Data::Dumper;

### Utility cruft

my %comparators =
(
   ""        => \&cmp_lex,
   "l"       => \&cmp_lex,
   "lex"     => \&cmp_lex,
   "lexical" => \&cmp_lex,

   # Ugh, "natural" is really the wrong name for numeric, I would expect
   # natural to handle any sequence of text and numbers.  Unfortunately, this
   # alias is sort of grandfathered in.
   "n"       => \&cmp_nat,
   "nat"     => \&cmp_nat,
   "natural" => \&cmp_nat,

   # add more accurate "numeric" alias
   "num"     => \&cmp_nat,
   "numeric" => \&cmp_nat,
);

sub cmp_lex
{
   my ($this, $that) = @_;
   return ($this cmp $that);
}

sub cmp_nat
{
   my ($this, $that) = @_;
   return ($this <=> $that);
}

sub get_comparators
{
   return [map { get_comparator($_) } @_];
}

{
   sub get_comparator
   {
      my ($comparator, $field) = get_comparator_and_field(@_);

      return $comparator;
   }

   sub get_comparator_and_field
   {
      my $spec = shift;

      my ($field, $direction, $comparator_name, $all_hack);

      if ( $spec =~ m/=/ )
      {
         ($field, $direction, $comparator_name, $all_hack) = $spec =~ /^(.*)=([-+]?)(.*?)(\*?)$/;
      }
      else
      {
         ($field, $direction, $comparator_name, $all_hack) = ($spec, undef, 'lexical', '');
      }

      $direction = '+' unless ( $direction );
      $all_hack = $all_hack ? 1 : 0;

      my $func = $comparators{$comparator_name};
      die "Not a valid comparator: $comparator_name" unless ( $func );

      my $comparator = sub {
         my ($this, $that) = @_;

         my $val = undef;

         if ( $all_hack )
         {
            my $this_value = ${$this->guess_key_from_spec($field)};
            my $that_value = ${$that->guess_key_from_spec($field)};
            if ( $this_value eq 'ALL' && $that_value ne 'ALL' )
            {
               $val = 1;
            }
            if ( $this_value ne 'ALL' && $that_value eq 'ALL' )
            {
               $val = -1;
            }
            if ( $this_value eq 'ALL' && $that_value eq 'ALL' )
            {
               return 0;
            }
         }

         if ( ! defined $val )
         {
            $val = $func->(${$this->guess_key_from_spec($field)}, ${$that->guess_key_from_spec($field)});
         }

         if ( $direction eq '-' )
         {
            return -$val;
         }

         return $val;
      };

      return ($comparator, $field);
   }
}

sub sort
{
   my $records = shift;
   my @specs   = @_;

   return CORE::sort { $a->cmp($b, @specs) } @$records;
}

### Actual class

our $AUTOLOAD;

sub new
{
   my $class = shift;

   if ( scalar @_ == 1 ) {
     my $arg = $_[0];
     if ( UNIVERSAL::isa($arg, 'HASH') ) {
       bless $arg, $class;
       return $arg;
     }
   }

   my $this = { @_ };
   bless $this, $class;

   return $this;
}

sub keys
{
   my ($this) = @_;
   return CORE::keys(%$this);
}

sub exists
{
   my ($this, $field) = @_;
   return exists($this->{$field});
}

sub get
{
   my ($this, $field) = @_;
   return $this->{$field};
}

sub set
{
   my ($this, $field, $val) = @_;

   my $old = $this->{$field};
   $this->{$field} = $val;

   return $old;
}

sub remove
{
   my ($this, @fields) = @_;

   my @old;
   for my $field (@fields)
   {
      push @old, delete $this->{$field};
   }

   return @old;
}

sub prune_to
{
   my ($this, @ok) = @_;

   my %ok = map { ($_ => 1) } @ok;
   for my $field (CORE::keys(%$this))
   {
      if(!exists($ok{$field}))
      {
         delete $this->{$field};
      }
   }
}

sub rename
{
   my ($this, $old, $new) = @_;

   $this->set($new, $this->get($old));
   $this->remove($old);
}

sub as_hash
{
   my ($this) = @_;
   return %$this;
}

sub as_hashref
{
   my ($this) = @_;
   return {%$this};
}

sub TO_JSON {
  my ($this) = @_;
  return $this->as_hashref();
}

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

sub _guess_key_name_raw {
   my ($this, $data, $key_chain, $fuzzy_matching, $search_string) = @_;

   if ( UNIVERSAL::isa($data, 'ARRAY') ) {
      if ( $search_string =~ m/^#(\d+)$/ ) {
         return $1;
      }
      else {
         die "Cannot select non-numeric index: $search_string for array: " . Dumper($data);
      }
   }

   return $search_string if ( ! $fuzzy_matching );

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

my $spec_parsed = {};

sub has_key_spec {
   my ($this, $spec) = @_;
   eval { $this->guess_key_from_spec($spec, 0, 1) };

   if ( $@ =~ m/^NoSuchKey/ ) {
      return 0;
   }
   elsif ( $@ ) {
      #Rethrow if a different error
      die $@;
   }

   return 1;
}

sub guess_key_from_spec {
   my ($this, $spec, $no_vivify, $throw_error) = @_;

   my ($parsed_spec, $fuzzy) = $this->_get_parsed_key_spec($spec);

   return $this->guess_key($fuzzy, $no_vivify, $throw_error, @$parsed_spec);
}

sub get_key_list_for_spec {
   my ($this, $spec) = @_;

   my ($parsed_spec, $fuzzy) = $this->_get_parsed_key_spec($spec);

   return $this->_guess_key_recurse($this, [], $fuzzy, 1, 0, 1, @$parsed_spec);
}

sub _get_parsed_key_spec {
   my ($this, $spec) = @_;

   return (@{$spec_parsed->{$spec}}) if ( defined $spec_parsed->{$spec} );

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

   $spec_parsed->{$spec_name} = [$keys, $fuzzy];
   return ($keys, $fuzzy);
}

{
   my $keylookup_hash = {};

   sub guess_key {
      my ($this, $fuzzy_match, $no_vivify, $throw_error, @args) = @_;

      $no_vivify   ||= 0;
      $throw_error ||= 0;
      my $args_string = join('-', @args, $no_vivify, $throw_error);

      if ( my $code = $keylookup_hash->{$args_string} ) {
         return $code->($this);
      }

      my $keys = $this->_guess_key_recurse($this, [], $fuzzy_match, $no_vivify, $throw_error, 1, @args);

      my $code = $this->_generate_keylookup_sub($keys, $no_vivify);
      $keylookup_hash->{$args_string} = $code;

      return $code->($this);
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
   my ($this, $data, $key_chain, $fuzzy_matching, $no_vivify, $throw_error,
       $return_key_chain, $search_string, @next_strings)  = @_;

   my $type = ref($data);

   if ( $type eq 'SCALAR' || UNIVERSAL::isa(\$data, 'SCALAR') ) {
      die "Cannot look for $search_string in scalar: " . Dumper($data);
   }

   my $key = $this->_guess_key_name_raw($data, $key_chain, $fuzzy_matching, $search_string);

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

      return $this->_guess_key_recurse($$value, 
                                       [@$key_chain, $key], 
                                       $fuzzy_matching, 
                                       $no_vivify, 
                                       $throw_error, 
                                       $return_key_chain, 
                                       @next_strings);
   }

   return $return_key_chain ? [@$key_chain, $key] : $value;
}

{
   my $key_groups = {};
   sub get_keys_for_group {
      my ($this, $group_string, $rerun) = @_;

      my $group = $key_groups->{$group_string};
      if ( ! $group ) {
         my $new_group                = App::RecordStream::KeyGroups->new($group_string);
         $key_groups->{$group_string} = $new_group;
         $group                       = $new_group;
      }

      if ( $rerun ) {
         return $group->get_keyspecs_for_record($this);
      }
      else {
         return $group->get_keyspecs($this);
      }
   }
}

sub get_group_values {
   my ($this, $group, $rerun) = @_;

   my $specs  = $this->get_keys_for_group($group, $rerun);
   my $values = [];

   foreach my $spec (@$specs) {
      push @$values, ${$this->guess_key_from_spec($spec)};
   }

   return $values;
}

sub cmp
{
   my ($this, $that, @keys) = @_;

   my $comparators = get_comparators(@keys);

   foreach my $comparator (@$comparators) {
      my $val = $comparator->($this, $that);
      return $val if ( $val != 0 );
   }

   return 0;
}

sub DESTROY {
}

sub AUTOLOAD
{
   my $this = shift;

   $AUTOLOAD =~ s/^.*://;

   if($AUTOLOAD =~ /^get_(.*)$/)
   {
      return get($this, $1, @_);
   }

   if($AUTOLOAD =~ /^set_(.*)$/)
   {
      return set($this, $1, @_);
   }

   die "No such method " . $AUTOLOAD . " for " . ref($this) . "\n";
}

sub keyspec_help {
   return <<KEYSPECS_HELP;
KEY SPECS   
   A key spec is short way of specifying a field with prefixes or regular
   expressions, it may also be nested into hashes and arrays.  Use a '/' to nest
   into a hash and a '#NUM' to index into an array (i.e. #2)
   
   An example is in order, take a record like this:
   
     {"biz":["a","b","c"],"foo":{"bar 1":1},"zap":"blah1"}
     {"biz":["a","b","c"],"foo":{"bar 1":2},"zap":"blah2"}
     {"biz":["a","b","c"],"foo":{"bar 1":3},"zap":"blah3"}
   
   In this case a key spec of 'foo/bar 1' would have the values 1,2, and 3
   in the respective records.
   
   Similarly, 'biz/#0' would have the value of 'a' for all 3 records
   
   You can also prefix key specs with '\@' to engage the fuzzy matching logic
   
   Fuzzy matching works like this in order, first key to match wins
     1. Exact match ( eq )
     2. Prefix match ( m/^/ )
     3. Match anywehre in the key (m//)
   
   So, in the above example '\@b/#2', the 'b' portion would expand to 'biz' and 2
   would be the index into the array, so all records would have the value of 'c'
   
   Simiarly, \@f/b would have values 1, 2, and 3

   You can escape / with a \\.  For example, if you have a record:
   {"foo/bar":2}

   You can address that key with foo\\/bar
KEYSPECS_HELP
}

1;
