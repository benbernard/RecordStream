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

our $VERSION = "4.0.5";

use strict;
use warnings;

use App::RecordStream::KeyGroups;
use App::RecordStream::KeySpec;

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

sub has_key_spec {
  my ($this, $spec) = @_;
  my $spec_obj = App::RecordStream::KeySpec->new($spec);
  return $spec_obj->has_key_spec($this);
}

sub guess_key_from_spec {
  return App::RecordStream::KeySpec::find_key(@_);
}

sub get_key_list_for_spec {
  my ($this, $spec) = @_;

  my $spec_obj = App::RecordStream::KeySpec->new($spec);
  return $spec_obj->get_key_list_for_spec($this);
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

1;
