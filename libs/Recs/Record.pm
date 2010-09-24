package Recs::Record;

=head1 NAME

Recs::Record

=head1 AUTHOR

Benjamin Bernard <perlhacker@benjaminbernard.com>
Keith Amling <keith.amling@gmail.com>

=head1 DESCRIPTION

An object representing a single record of recs input/output.  This is a
glorified hash with some helper methods.

=head1 SYNOPSIS

    use Recs::Record;
    my $record = Recs::Record->new("name" => "John Smith", "age" => 39);

=head1 CONSTRUCTOR

=over 4

=item Recs::Record->new(%hash);

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

=item $old_value = $this->remove($key);

Remove a field from the record, returns the old value, or undef if there was no
such field.

=item $this->prune(@keys);

Removes any fields whose names are not among those provided.

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

=item $value_ref = $this->guess_key_from_spec($keyspec)

Get the reference for a key spec.  Commonly used like:

${$r->guess_key_from_spec('foo/bar')} eq 'zip'
${$r->guess_key_from_spec('foo/bar')} = 'boo'

(the assign back gets back into the record)

See 'man recs' for more info on key specs

=item $comparators_ref = Recs::Record::get_comparators(@specs)

Calls get_comparator for each element of @specs and returns the results
together in an array reference.

=item $comparator = Recs::Record::get_comparator($spec)

Produces a comparator function (which takes two records and returns similarly
to <=> or cmp) from the provided $spec.  $spec should be like "<field>" for
lexical sort, or "<field>=<sign><type>" where <sign> is "+" or "" for ascending
or "-" for descending and type is one of the known types.  Type include "",
"l", "lex", or "lexical" for lexical sort (using cmp), and "n", "num" or
"numeric" for numeric sort (using <=>).

=item @sorted_records = Recs::Record::sort($records_ref, @specs)

Sorts an array ref of records using the provided specs, returns an array of
records.

=back

=cut

use strict;
use lib;

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
   my %parsed_comparators;
   sub get_comparator 
   {
      my $spec = shift;

      my $parsed = $parsed_comparators{$spec};
      return $parsed if ( $parsed ) ;

      my ($field, $direction, $comparator);

      if ( $spec =~ m/=/ ) 
      {
         ($field, $direction, $comparator) = $spec =~ /^(.*)=([-+])?(.*)$/;
      }
      else 
      {
         ($field, $direction, $comparator) = ($spec, undef, 'lexical');
      }

      $direction = '+' unless ( $direction );

      my $func = $comparators{$comparator};
      die "Not a valid comparator: $comparator" unless ( $func );

      return sub {
         my ($this, $that) = @_;
         my $val = $func->(${$this->guess_key_from_spec($field)}, ${$that->guess_key_from_spec($field)});

         if ( $direction eq '-' ) 
         {
            return -$val;
         }

         return $val;
      }
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
   my ($this, $field) = @_;

   my $old = $this->{$field};
   delete $this->{$field};

   return $old;
}

sub prune
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

my $guessed_keys = {};

sub _search_string_to_key {
   my $key_chain = shift;
   my $string    = shift;

   return $guessed_keys->{$key_chain}->{$string};
}

sub _add_string_key_mapping {
   my $key_chain = shift;
   my $string    = shift;
   my $key       = shift;

   $guessed_keys->{$key_chain}->{$string} = $key;
}

sub _guess_key_name_raw {
   my $this           = shift;
   my $data           = shift;
   my $key_chain      = shift;
   my $fuzzy_matching = shift;
   my $search_string  = shift;

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
      $found_key = $key;
   }
   # First check exact match
   elsif ( defined $data->{$search_string} ) {
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

sub guess_key_from_spec {
   my ($this, $spec, $no_vivify) = @_;

   my $fuzzy = 0;

   if ( substr($spec, 0, 1) eq '@' ) {
      $fuzzy = 1;
      $spec = substr($spec, 1);
   }

   if ( ! (defined $spec_parsed->{$spec}) ) {
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

      $spec_parsed->{$spec} = $keys;
   }

   return $this->guess_key($fuzzy, $no_vivify, @{$spec_parsed->{$spec}});
}

sub guess_key {
   my ($this, $fuzzy_match, $no_vivify, @args) = @_;
   return $this->_guess_key_recurse($this, '', $fuzzy_match, $no_vivify, @args);
}

sub _guess_key_recurse {
   my $this           = shift;
   my $data           = shift;
   my $key_chain      = shift;
   my $fuzzy_matching = shift;
   my $no_vivify      = shift;
   my $search_string  = shift;
   my @next_strings   = @_;
   my $found_key;

   if ( UNIVERSAL::isa($data, 'SCALAR') || UNIVERSAL::isa(\$data, 'SCALAR') ) {
      die "Cannot look for $search_string in scalar: " . Dumper($data);
   }

   my $key = $this->_guess_key_name_raw($data, $key_chain, $fuzzy_matching, $search_string);

   my $value;

   if ( UNIVERSAL::isa($data, 'ARRAY') ) {
      $value = \($data->[$key]);
   }
   else {
      $value = \($data->{$key})
   }

   if ( scalar @next_strings > 0 ) {
      if ( ! defined $$value ) {
         if ( $no_vivify ) {
            return '';
         }

         if ( substr($next_strings[0], 0, 1) eq '#' ) {
            $$value = [];
         }
         else {
            $$value = {};
         }
      }

      return $this->_guess_key_recurse($$value, $key_chain . "-$key", $fuzzy_matching, $no_vivify, @next_strings);
   }

   return $value;
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
   if($AUTOLOAD eq "DESTROY")
   {
      return;
   }

   die "No such method " . $AUTOLOAD . " for " . ref($this) . "\n";
}

1;
