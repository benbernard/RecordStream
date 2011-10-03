package App::RecordStream::KeyGroups;
our $VERSION = "3.4";

use strict;
use warnings;

sub new {
   my $class = shift;
   my @args  = @_;

   my $this = {
      KEY_GROUPS => [],
   };

   bless $this, $class;

   $this->add_groups($_) foreach @args;

   return $this;
};

sub has_any_group {
   my $this   = shift;
   return (scalar @{$this->{'KEY_GROUPS'}}) > 0;
}

sub add_groups {
   my $this   = shift;
   my $groups = shift;

   foreach my $group_spec (split(',', $groups)) {
      my $group;
      if ( $group_spec =~ m/^!/ ) {
         $group = App::RecordStream::KeyGroups::Group->new($group_spec);
      }
      else {
         $group = App::RecordStream::KeyGroups::KeySpec->new($group_spec);
      }

      push @{$this->{'KEY_GROUPS'}}, $group;
   }
}

sub get_keyspecs_for_record {
   my $this   = shift;
   my $record = shift;

   my @specs;

   foreach my $group ( @{$this->{'KEY_GROUPS'}} ) {
      push @specs, @{$group->get_fields($record)};
   }

   return \@specs;
}

# This is a cached version
sub get_keyspecs {
   my $this   = shift;
   my $record = shift;

   if ( !$this->{'KEY_SPECS'} ) {
      $this->{'KEY_SPECS'} = $this->get_keyspecs_for_record($record);
   }

   return $this->{'KEY_SPECS'};
}

sub usage {
   return <<HELP;
KEY GROUPS
   __FORMAT_TEXT__
   SYNTAX: !regex!opt1!opt2...
   Key groups are a way of specifying multiple fields to a recs command with a
   single argument or function.  They are generally regexes, and have several
   options to control what fields they match.  By default you give a regex, and
   it will be matched against all first level keys of a record to come up with
   the record list.  For instance, in a record like this:
   __FORMAT_TEXT__

   { 'zip': 1, 'zap': 2, 'foo': { 'bar': 3 } }

   __FORMAT_TEXT__
   Key group: !z! would get the keys 'zip' and 'zap'

   You can have a literal '!' in your regex, just escape it with a \\.

   Normally, key groups will only match keys whose values are scalars.  This
   can be changed with the 'returnrefs' or rr flag.

   With the above record !f! would match no fields, but !f!rr would match foo
   (which has a value of a hash ref)

   Options on KeyGroups:
   __FORMAT_TEXT__
      returnrefs, rr  - Return keys that have reference values (default:off)
      full, f         - Regex should match against full keys (recurse fully)
      depth=NUM,d=NUM - Only match keys at NUM depth (regex will match against
                        full keyspec)
      sort, s         - sort keyspecs lexically
HELP
}

1;

package App::RecordStream::KeyGroups::KeySpec;

sub new {
   my $class = shift;
   my $spec  = shift;

   my $this = {
      SPEC => $spec,
   };

   return bless $this, $class;
}

sub get_fields {
   my $this   = shift;
   my $record = shift;

   if ( $record->has_key_spec($this->{'SPEC'}) ) {
      return [join('/', @{$record->get_key_list_for_spec($this->{'SPEC'})})];
   }

   return [];
}

1;

package App::RecordStream::KeyGroups::Group;

my $VALID_OPTIONS = {
   d          => 'depth',
   depth      => 'depth',
   s          => 'sort',
   'sort'     => 'sort',
   f          => 'full_match',
   full       => 'full_match',
   rr         => 'return_refs',
   returnrefs => 'return_refs'
};

sub new {
   my $class      = shift;
   my $group_spec = shift;

   my $this = {
   };

   bless $this, $class;

   $this->parse_group($group_spec);
   return $this;
}

sub get_fields {
   my $this   = shift;
   my $record = shift;

   my @specs;
   my $regex = $this->{'REGEX'};
   foreach my $spec (@{$this->get_specs($record)}) {
      if ( $spec =~ m/$regex/ ) {
         push @specs, $spec;
      }
   }

   #TODO: deal with sorts
   if ( $this->has_option('sort') ) {
      @specs = sort @specs;
   }
   return \@specs;
}

sub get_specs {
   my $this   = shift;
   my $record = shift;

   my $min_depth = 1;
   my $max_depth = 1;

   if ( $this->has_option('full_match') ) {
      $max_depth = -1;

   }
   elsif ( $this->has_option('depth') ) {
      my $depth = $this->option_value('depth');
      $min_depth = $depth;
      $max_depth = $depth;
   }

   my $paths = [];
   $this->_get_paths({%$record}, 1, $min_depth, $max_depth, [], $paths);
   return [map { join('/', @$_) } @$paths];
}

sub _get_paths {
   my $this          = shift;
   my $data          = shift;
   my $current_depth = shift;
   my $min_depth     = shift;
   my $max_depth     = shift;
   my $current_keys  = shift;
   my $found_paths   = shift;

   if ( $current_depth >= $min_depth ) {
      if ( ref($data) eq '' || $this->has_option('return_refs') ) {
         push @$found_paths, [@$current_keys];
      }
   }

   if ( ref($data) eq 'ARRAY' ) {
      my $index = -1;
      foreach my $value ( @$data ) {
         $index++;
         if ( $current_depth <= $max_depth || $max_depth == -1 ) {
            $this->_get_paths($value, 
                              $current_depth+1, 
                              $min_depth, 
                              $max_depth, 
                              [@$current_keys, "\#index"], 
                              $found_paths);
         }
      }
   }
   if ( ref($data) eq 'HASH') {
      foreach my $key (keys %$data) {
         if ( $current_depth <= $max_depth || $max_depth == -1 ) {
            $this->_get_paths($data->{$key}, 
                              $current_depth+1, 
                              $min_depth, 
                              $max_depth, 
                              [@$current_keys, $key], 
                              $found_paths);
         }
      }
   }
}

sub parse_group {
   my $this = shift;
   my $spec = shift;

   if ( '!' ne substr($spec, 0, 1) ) {
      die "Malformed group spec: '$spec', does not start with '!'\n";
   }

   if ( length($spec) < 2 ) {
      die "Malformed group spec: '$spec', does not have enough length\n";
   }

   my $regex              = '';
   my $last_char          = '';
   my $found_end          = 0;
   my $start_option_index = 1;

   for (my $index = 1; $index < length($spec); $index++) {
      $start_option_index++;
      my $current_char = substr($spec, $index, 1);

      if ( $current_char eq '!' ) {
         if ( $last_char ne '\\' ) {
            $last_char = $current_char;
            $found_end = 1;
            last;
         }
      }
      $last_char = $current_char;
      $regex .= $current_char;
      next;
   }

   die "Malformed group spec: Did not find terminating '!' in '$spec'\n" if ( ! $found_end );

   my $options_string = substr($spec, $start_option_index);
   my $options = {};

   foreach my $option_group (split('!', $options_string)) {
      my ($option, $value) = split('=', $option_group);
      if ( my $normalized_option = $VALID_OPTIONS->{$option} ) {
         if ( exists $options->{$normalized_option} ) {
            die "Already specified option '$option'.  Bad option: '$option_group' in '$spec'\n";
         }
         else {
            $options->{$normalized_option} = $value;
         }
      }
      else {
         die "Malformed group spec: Unrecognized option: '$option' in '$spec'\n";
      }
   }

   $this->{'REGEX'}   = $regex;
   $this->{'OPTIONS'} = $options;
}

sub has_option {
   my $this   = shift;
   my $option = shift;

   return exists $this->{'OPTIONS'}->{$option};
}

sub option_value {
   my $this   = shift;
   my $option = shift;

   return $this->{'OPTIONS'}->{$option};
}

1;
