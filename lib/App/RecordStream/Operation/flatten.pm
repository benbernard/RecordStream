package App::RecordStream::Operation::flatten;

our $VERSION = "3.4";

use strict;

use base qw(App::RecordStream::Operation);

my $INVALID_REF_TYPES = [qw(
   SCALAR
   ARRAY
   CODE
   REF
   GLOB
   LVALUE
   FORMAT
   IO
   VSTRING
   Regexp
)];

sub init {
   my $this = shift;
   my $args = shift;


   my @fields;
   my $default_depth = 1;
   my $separator     = '-';


   my $add_field = sub {
      my ($depth, $field_names) = @_;

      my $key_groups = App::RecordStream::KeyGroups->new();
      $key_groups->add_groups($field_names);

      push @fields, [$depth, $key_groups];
   };

   my $spec = {
      (map { ($_ . "=s") => $add_field } (1..9)),
      "depth=i"          => \$default_depth,
      "key|k|field|f=s"  => sub { $add_field->($default_depth, $_[1]); },
      "deep=s"           => sub { $add_field->(-1, $_[1]); },
      "separator=s"      => \$separator,
   };

   $this->parse_options($args, $spec);

   $this->{'FIELDS'}        = \@fields;
   $this->{'SEPARATOR'}     = $separator;
   $this->{'DEFAULT_DEPTH'} = $default_depth;
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $fields    = $this->{'FIELDS'};
   my $separator = $this->{'SEPARATOR'};

   foreach my $pair (@$fields) {
      my ($depth, $key_groups) = @$pair;
      foreach my $spec (@{$key_groups->get_keyspecs($record)}) {
         eval {
            my $value = $this->remove_spec($record, $spec);
            $this->split_field($record, $spec, $depth, $value);
         };

         if ( $@ =~ m/Cannot flatten into/ ) {
            warn $@;
            undef $@;
            next;
         }
         elsif ( $@ ) {
            die $@;
         }
      }
   }

   $this->push_record($record);

   return 1;
}

sub remove_spec {
   my ($this, $record, $spec) = @_;
   my $key_list = $record->get_key_list_for_spec($spec);

   my $last_key = pop @$key_list;
   my $new_spec = join('/', @$key_list);

   my $data = $record;
   if ($new_spec) {
      $data = ${$record->guess_key_from_spec($new_spec, 1)};
   }

   my $ref_type = ref($data);
   if ( ! grep { $_ eq $ref_type } @$INVALID_REF_TYPES ) {
      return delete $data->{$last_key};
   }
   else {
      die "Cannot flatten into ref type: '$ref_type', must be a hash! skipping spec $spec!\n";
   }
}

sub split_field {
   my ($this, $record, $name, $depth, $value) = @_;

   my $separator = $this->{'SEPARATOR'};

   if($depth != 0 && ref($value) eq "ARRAY") {
      for(my $i = 0; $i < @$value; ++$i) {
         $this->split_field($record, $name . $separator . $i, $depth - 1, $value->[$i]);
      }
      return;
   }

   if($depth != 0 && ref($value) eq "HASH") {
      for my $key (keys(%$value)) {
         $this->split_field($record, $name . $separator . $key, $depth - 1, $value->{$key});
      }
      return;
   }

   # either depth is 0 or it wasn't expandable anyway
   ${$record->guess_key_from_spec($name)} = $value;
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
      [ '<n> <fields>', 'For this comma-separated list of fields flatten to depth n (1-9).'],
      [ 'depth <nbr>', 'Change the default depth, negative being arbitrary depth (defaults to 1).'],
      [ 'key <fields>', 'For this comma-separated list of fields flatten to the default depth (may NOT be a a key spec).'],
      [ 'deep <fields>', 'For this comma-separated list of fields flatten to arbitrary depth.'],
      [ 'separator <string>', 'Use this string to separate joined field names (defaults to "-").'],
   ];

   my $args_string = $this->options_string($options);

   return <<USAGE;
Usage: recs-flatten <args> [<files>]
   __FORMAT_TEXT__
   Flatten nested structues in records.

   NOTE:  This script implements a strategy for dealing with nested structures
   that is almost always better handled by using keyspecs or keygroups.  It
   should, in general, be as easy or easier to use those concepts with the data
   manipulations you actually want to accomplish.
   __FORMAT_TEXT__

Arguments:
$args_string

   __FORMAT_TEXT__
    All field values may be keyspecs or keygroups, value of keyspec must not be
    an array element
   __FORMAT_TEXT__

Examples:
   Under
      recs-flatten -1 field
   We see
      {"field" => "value"} becomes {"field" => "value"}
      {"field" => {"subfield" => "value"}} becomes {"field-subfield" => "value"}
      {"field" => ["value1", "value2"]} becomes {"field-0" => "value1", "field-1" => "value2"}
      {"field" => {"subfield" => [0, 1]}} becomes {"field-subfield" => [0, 1]}}
   Under
      recs-flatten --deep x
   We see
      {"x" => {"y" => [{"z" = "v"}]}} becomes {"x-y-0-z" => "v"}
USAGE
}

1;
