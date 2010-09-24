package Recs::Operation::flatten;

use strict;

use base qw(Recs::Operation);

sub init {
   my $this = shift;
   my $args = shift;


   my %fields;
   my $default_depth = 1;
   my $separator     = '-';

   my $add_field = sub {
      my ($depth, $field_names) = @_;

      for my $field (split(/,/, $field_names)) {
         $fields{$field} = $depth;
      }
   };

   my $spec = {
      (map { ($_ . "=s") => $add_field } (1..9)),
      "depth=i"     => \$default_depth,
      "field=s"     => sub { $add_field->($default_depth, $_[1]); },
      "deep=s"      => sub { $add_field->(-1, $_[1]); },
      "separator=s" => \$separator,
   };

   $this->parse_options($args, $spec);

   $this->{'FIELDS'}        = \%fields;
   $this->{'SEPARATOR'}     = $separator;
   $this->{'DEFAULT_DEPTH'} = $default_depth;
}

sub accept_record {
   my $this   = shift;
   my $record = shift;

   my $fields = $this->{'FIELDS'};

   foreach my $field (keys %$fields) {
      if(!exists($fields->{$field})) {
         next;
      }
      my $value = $record->remove($field);
      $this->split_field($record, $field, $fields->{$field}, $value);
   }

   $this->push_record($record);
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

   $record->set($name, $value);
}


sub usage {
   return <<USAGE;
Usage: recs-flatten <args> [<files>]
   Flatten nested structues in records.

   NOTE: This script does not support key specs

Arguments:
   -<n> <fields>          For this comma-separated list of fields flatten to
                          depth n (1-9).
   --depth <nbr>          Change the default depth, negative being arbitrary
                          depth (defaults to 1).
   --field <fields>       For this comma-separated list of fields flatten to the
                          default depth (may NOT be a a key spec).
   --deep <fields>        For this comma-separated list of fields flatten to
                          arbitrary depth.
   --separator <string>   Use this string to separate joined field names
                          (defaults to "-").
   --help                 Bail and output this help screen.

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
