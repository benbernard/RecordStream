package Date::Manip::TZ_Base;
# Copyright (c) 2010-2014 Sullivan Beck. All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

########################################################################
########################################################################

require 5.010000;
use warnings;
use strict;
use IO::File;

our ($VERSION);
$VERSION='6.47';
END { undef $VERSION; }

########################################################################
# METHODS
########################################################################

sub _config_var {
   my($self,$var,$val) = @_;
   $var = lc($var);

   # A simple flag used to force a new configuration, but has
   # no other affect.
   return  if ($var eq 'ignore');

   my $istz     = ref($self) eq 'Date::Manip::TZ';

   if ($istz  &&  ($var eq 'tz'         ||
                   $var eq 'forcedate'  ||
                   $var eq 'setdate'    ||
                   $var eq 'configfile')) {
      return $self->_config_var_tz($var,$val);
   } else {
      my $base  = ($istz ? $$self{'base'} : $self);
      return $base->_config_var_base($var,$val);
   }
}

# This reads a config file
#
sub _config_file {
   my($self,$file) = @_;

   return  if (! $file);

   if (! -f $file) {
      warn "ERROR: [config_file] file doesn't exist: $file\n";
      return;
   }
   if (! -r $file) {
      warn "ERROR: [config_file] file not readable: $file\n";
      return;
   }

   my $in = new IO::File;
   if (! $in->open($file)) {
      warn "ERROR: [config_file] unable to open file: $file: $!\n";
      return;
   }
   my @in = <$in>;
   $in->close();

   my $sect = 'conf';
   my %sect;

   chomp(@in);
   foreach my $line (@in) {
      $line =~ s/^\s+//o;
      $line =~ s/\s+$//o;
      next  if (! $line  or  $line =~ /^\043/o);

      if ($line =~ /^\*/o) {
         # New section
         $sect = $self->_config_file_section($line);
      } else {
         $sect{$sect} = 1;
         $self->_config_file_var($sect,$line);
      }
   }

   # If we did a holidays section, we need to create a regular
   # expression with all of the holiday names.

   my $istz  = ref($self) eq 'Date::Manip::TZ';
   my $base  = ($istz ? $$self{'base'} : $self);

   if (exists $sect{'holidays'}) {
      my @hol = @{ $$base{'data'}{'sections'}{'holidays'} };
      my @nam;
      while (@hol) {
         my $junk = shift(@hol);
         my $hol  = shift(@hol);
         push(@nam,$hol)  if ($hol);
      }

      if (@nam) {
         @nam    = sort _sortByLength(@nam);
         my $hol = '(?<holiday>' . join('|',map { "\Q$_\E" } @nam) . ')';
         my $yr  = '(?<y>\d\d\d\d|\d\d)';

         my $rx  = "$hol\\s*$yr|" .      # Christmas 2009
                   "$yr\\s*$hol|" .      # 2009 Christmas
                   "$hol";               # Christmas

         $$base{'data'}{'rx'}{'holidays'} = qr/^(?:$rx)$/i;
      }
   }
}

sub _config_file_section {
   my($self,$line) = @_;

   my $istz  = ref($self) eq 'Date::Manip::TZ';
   my $base  = ($istz ? $$self{'base'} : $self);

   $line    =~ s/^\*//o;
   $line    =~ s/\s*$//o;
   my $sect = lc($line);
   if (! exists $$base{'data'}{'sections'}{$sect}) {
      warn "WARNING: [config_file] unknown section created: $sect\n";
      $base->_section($sect);
   }
   return $sect;
}

sub _config_file_var {
   my($self,$sect,$line) = @_;

   my $istz  = ref($self) eq 'Date::Manip::TZ';
   my $base  = ($istz ? $$self{'base'} : $self);

   my($var,$val);
   if ($line =~ /^\s*(.*?)\s*=\s*(.*?)\s*$/o) {
      ($var,$val) = ($1,$2);
   } else {
      die "ERROR: invalid Date::Manip config file line:\n  $line\n";
   }

   if ($sect eq 'conf') {
      $var = lc($var);
      $self->_config($var,$val);
   } else {
      $base->_section($sect,$var,$val);
   }
}

# $val = $self->config(VAR);
#    Returns the value of a variable.
#
# $self->config([SECT], VAR, VAL)  sets the value of a variable
#    Sets the value of a variable.
#
sub _config {
   my($self,$var,$val) = @_;

   my $sect = 'conf';

   #
   # $self->_conf(VAR, VAL)  sets the value of a variable
   #

   $var = lc($var);
   if (defined $val) {
      return $self->_config_var($var,$val);
   }

   #
   # $self->_conf(VAR)       returns the value of a variable
   #

   if (exists $$self{'data'}{'sections'}{$sect}{$var}) {
      return $$self{'data'}{'sections'}{$sect}{$var};
   } else {
      warn "ERROR: [config] invalid config variable: $var\n";
      return '';
   }
}

########################################################################

sub _fix_year {
   my($self,$y) = @_;
   my $istz     = ref($self) eq 'Date::Manip::TZ';
   my $base     = ($istz ? $self->base() : $self);

   my $method   = $base->_config('yytoyyyy');

   return $y     if (length($y)==4);
   return undef  if (length($y)!=2);

   my $curr_y;
   if (ref($self) eq 'Date::Manip::TZ') {
      $curr_y  = $self->_now('y',1);
   } else {
      $curr_y  = ( localtime(time) )[5];
      $curr_y += 1900;
   }

   if ($method eq 'c') {
      return substr($curr_y,0,2) . $y;

   } elsif ($method =~ /^c(\d\d)$/) {
      return "$1$y";

   } elsif ($method =~ /^c(\d\d)(\d\d)$/) {
      return "$1$y" + ($y<$2 ? 100 : 0);

   } else {
      my $y1      = $curr_y - $method;
      my $y2      = $y1 + 99;
      $y1         =~ /^(\d\d)/;
      $y          = "$1$y";
      if ($y<$y1) {
         $y += 100;
      }
      if ($y>$y2) {
         $y -= 100;
      }
      return $y;
   }
}

###############################################################################
# Functions for setting the default date/time

# Many date operations use a default time and/or date to set some
# or all values.  This function may be used to set or examine the
# default time.
#
# _now allows you to get the current date and/or time in the
# local timezone.
#
# The function performed depends on $op and are described in the
# following table:
#
#    $op                  function
#    ------------------   ----------------------------------
#    undef                Returns the current default values
#                         (y,m,d,h,mn,s) without updating
#                         the time (it'll update if it has
#                         never been set).
#
#    'now'                Updates now and returns
#                         (y,m,d,h,mn,s)
#
#    'time'               Updates now and Returns (h,mn,s)
#
#    'y'                  Returns the default value of one
#    'm'                  of the fields (no update)
#    'd'
#    'h'
#    'mn'
#    's'
#
#    'systz'              Returns the system timezone
#
#    'isdst'              Returns the 'now' values if set,
#    'tz'                 or system time values otherwise.
#    'offset'
#    'abb'
#
sub _now {
   my($self,$op,$noupdate) = @_;
   my $istz      = ref($self) eq 'Date::Manip::TZ';
   my $base      = ($istz ? $self->base() : $self);

   # Update "NOW" if we're checking 'now', 'time', or the date
   # is not set already.

   if (! defined $noupdate) {
      if ($op =~ /(?:now|time)/) {
         $noupdate = 0;
      } else {
         $noupdate = 1;
      }
   }
   $noupdate = 0  if (! exists $$base{'data'}{'now'}{'date'});
   $self->_update_now()  unless ($noupdate);

   # Now return the value of the operation

   my @tmpnow   = @{ $$base{'data'}{'tmpnow'} };
   my @now      = (@tmpnow ? @tmpnow : @{ $$base{'data'}{'now'}{'date'} });

   if ($op eq 'tz') {
      if (exists $$base{'data'}{'now'}{'tz'}) {
         return $$base{'data'}{'now'}{'tz'};
      } else {
         return $$base{'data'}{'now'}{'systz'};
      }

   } elsif ($op eq 'systz') {
      return $$base{'data'}{'now'}{'systz'};

   } elsif ($op eq 'isdst') {
      return $$base{'data'}{'now'}{'isdst'};

   } elsif ($op eq 'offset') {
      return @{ $$base{'data'}{'now'}{'offset'} };

   } elsif ($op eq 'abb') {
      return $$base{'data'}{'now'}{'abb'};

   } elsif ($op eq 'now') {
      return @now;

   } elsif ($op eq 'y') {
      return $now[0];

   } elsif ($op eq 'time') {
      return @now[3..5];

   } elsif ($op eq 'm') {
      return $now[1];

   } elsif ($op eq 'd') {
      return $now[2];

   } elsif ($op eq 'h') {
      return $now[3];

   } elsif ($op eq 'mn') {
      return $now[4];

   } elsif ($op eq 's') {
      return $now[5];

   } else {
      warn "ERROR: [now] invalid argument list: $op\n";
      return ();
   }
}

sub _update_now {
   my($self) = @_;
   my $istz     = ref($self) eq 'Date::Manip::TZ';
   my $base     = ($istz ? $self->base() : $self);

   # If we've called ForceDate, don't change it.
   return  if ($$base{'data'}{'now'}{'force'});

   # If we've called SetDate (which will only happen if a
   # Date::Manip:TZ object is available), figure out what 'now' is
   # based on the number of seconds that have elapsed since it was
   # set.  This will ONLY happen if TZ has been loaded.

   if ($$base{'data'}{'now'}{'set'}) {
      my $date = $$base{'data'}{'now'}{'setdate'};
      my $secs = time - $$base{'data'}{'now'}{'setsecs'};

      $date      = $base->calc_date_time($date,[0,0,$secs]);  # 'now' in GMT
      my $zone   = $self->_now('tz',1);
      my ($err,$date2,$offset,$isdst,$abbrev) = $self->convert_from_gmt($date,$zone);

      $$base{'data'}{'now'}{'date'}   = $date2;
      $$base{'data'}{'now'}{'isdst'}  = $isdst;
      $$base{'data'}{'now'}{'offset'} = $offset;
      $$base{'data'}{'now'}{'abb'}    = $abbrev;
      return;
   }

   # Otherwise, we'll use the system time.

   my $time = time;
   my($s,$mn,$h,$d,$m,$y,$wday,$yday,$isdst) = localtime($time);
   my($s0,$mn0,$h0,$d0,$m0,$y0)              = gmtime($time);

   $y += 1900;
   $m++;

   $y0 += 1900;
   $m0++;

   my $off = $base->calc_date_date([$y,$m,$d,$h,$mn,$s],[$y0,$m0,$d0,$h0,$mn0,$s0],1);

   $$base{'data'}{'now'}{'date'}  = [$y,$m,$d,$h,$mn,$s];
   $$base{'data'}{'now'}{'isdst'} = $isdst;
   $$base{'data'}{'now'}{'offset'}= $off;

   my $abb = '???';
   if (ref($self) eq 'Date::Manip::TZ') {
      my $zone   = $self->_now('tz',1);
      my $per    = $self->date_period([$y,$m,$d,$h,$mn,$s],$zone,1,$isdst);
      $abb = $$per[4];
   }

   $$base{'data'}{'now'}{'abb'}   = $abb;

   return;
}

###############################################################################
# This sorts from longest to shortest element
#
no strict 'vars';
sub _sortByLength {
   return (length $b <=> length $a);
}
use strict 'vars';

1;
# Local Variables:
# mode: cperl
# indent-tabs-mode: nil
# cperl-indent-level: 3
# cperl-continued-statement-offset: 2
# cperl-continued-brace-offset: 0
# cperl-brace-offset: 0
# cperl-brace-imaginary-offset: 0
# cperl-label-offset: 0
# End:
