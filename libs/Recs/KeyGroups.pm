package Recs::KeyGroups;

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

sub add_groups {
   my $this   = shift;
   my $groups = shift;

   foreach my $group_spec (split(',', $groups)) {
      my $group;
      if ( $group_spec =~ m/^!/ ) {
         $group = Recs::KeyGroups::Group->new($group_spec);
      }
      else {
         $group = Recs::KeyGroups::KeySpec->new($group_spec);
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

sub help {
}

1;

package Recs::KeyGroups::KeySpec;

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

package Recs::KeyGroups::Group;

my $VALID_OPTIONS = {
   d      => 'depth',
   depth  => 'depth',
   s      => 'sort',
   'sort' => 'sort',
   f      => 'full_match',
   full   => 'full_match',
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
   return \@specs;
}

sub get_specs {
   my $this   = shift;
   my $record = shift;

   my $min_depth = 1;
   my $max_depth = 1;

   if ( exists $this->{'OPTIONS'}->{'full_match'} ) {
      $max_depth = -1;

   }
   elsif ( exists $this->{'OPTIONS'}->{'depth'} ) {
      my $depth = $this->{'OPTIONS'}->{'depth'};
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

   $DB::single=1;

   if ( ref($data) eq '' ) {
      if ( $current_depth >= $min_depth ) {
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

1;
