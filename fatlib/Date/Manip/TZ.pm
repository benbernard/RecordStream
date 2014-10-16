package Date::Manip::TZ;
# Copyright (c) 2008-2014 Sullivan Beck. All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

########################################################################
# Any routine that starts with an underscore (_) is NOT intended for
# public use.  They are for internal use in the the Date::Manip
# modules and are subject to change without warning or notice.
#
# ABSOLUTELY NO USER SUPPORT IS OFFERED FOR THESE ROUTINES!
########################################################################

use Date::Manip::Obj;
use Date::Manip::TZ_Base;
@ISA = qw(Date::Manip::Obj Date::Manip::TZ_Base);

require 5.010000;
use warnings;
use strict;

use IO::File;
require Date::Manip::Zones;
use Date::Manip::Base;

our $VERSION;
$VERSION='6.47';
END { undef $VERSION; }

# To get rid of a 'used only once' warnings.
END {
   my $tmp = \%Date::Manip::Zones::Module;
   $tmp    = \%Date::Manip::Zones::ZoneNames;
   $tmp    = \%Date::Manip::Zones::Alias;
   $tmp    = \%Date::Manip::Zones::Abbrev;
   $tmp    = \%Date::Manip::Zones::Offmod;
   $tmp    = $Date::Manip::Zones::FirstDate;
   $tmp    = $Date::Manip::Zones::LastDate;
   $tmp    = $Date::Manip::Zones::LastYear;
   $tmp    = $Date::Manip::Zones::TzcodeVersion;
   $tmp    = $Date::Manip::Zones::TzdataVersion;
}

########################################################################
# BASE METHODS
########################################################################

sub _init {
   my($self) = @_;

   $$self{'data'} =
     {
      # These are the variables defined in Date::Manip::Zones
      'Module'         => \%Date::Manip::Zones::Module,
      'ZoneNames'      => \%Date::Manip::Zones::ZoneNames,
      'Alias'          => \%Date::Manip::Zones::Alias,
      'Abbrev'         => \%Date::Manip::Zones::Abbrev,
      'Offmod'         => \%Date::Manip::Zones::Offmod,
      'FirstDate'      => $Date::Manip::Zones::FirstDate,
      'LastDate'       => $Date::Manip::Zones::LastDate,
      'LastYear'       => $Date::Manip::Zones::LastYear,

      # These override values from Date::Manip::Zones
      'MyAlias'        => {},
      'MyAbbrev'       => {},
      'MyOffsets'      => {},

      # Each timezone/offset module that is loaded goes here
      'Zones'          => {},
      'Offsets'        => {},

      # methods     a list of methods used for determining the
      #             current zone
      # path        the PATH to set for determining the current
      #             zone
      # dates       critical dates on a per/year (UT) basis
      # zonerx      the regular expression for matching timezone
      #             names/aliases
      # abbrx       the regular expression for matching timezone
      #             abbreviations
      # offrx       the regular expression for matching a valid
      #             timezone offset
      # zrx         the regular expression to match all timezone
      #             information
      'methods'        => [],
      'path'           => undef,
      'zonerx'         => undef,
      'abbrx'          => undef,
      'offrx'          => undef,
      'zrx'            => undef,
     };

   # OS specific stuff

   my $dmb = $$self{'base'};
   my $os  = $dmb->_os();

   if ($os eq 'Unix') {
      $$self{'data'}{'path'}    = '/bin:/usr/bin';
      $$self{'data'}{'methods'} = [
                                   qw(main TZ
                                      env  zone TZ
                                      file /etc/TIMEZONE
                                      file /etc/timezone
                                      file /etc/sysconfig/clock
                                      file /etc/default/init
                                    ),
                                   'command',  '/bin/date +%Z',
                                   'command',  '/usr/bin/date +%Z',
                                   'command',  '/usr/local/bin/date +%Z',
                                   qw(cmdfield /bin/date -2
                                      cmdfield /usr/bin/date -2
                                      cmdfield /usr/local/bin/date -2
                                    ),
                                   'command',  '/bin/date +%z',
                                   'command',  '/usr/bin/date +%z',
                                   'command',  '/usr/local/bin/date +%z',
                                   'gmtoff'
                                  ];

   } elsif ($os eq 'Windows') {
      $$self{'data'}{'methods'} = [
                                   qw(main TZ
                                      env  zone TZ
                                      registry
                                      gmtoff),
                                  ];

   } elsif ($os eq 'VMS') {
      $$self{'data'}{'methods'} = [
                                   qw(main TZ
                                      env  zone TZ
                                      env  zone SYS$TIMEZONE_NAME
                                      env  zone UCX$TZ
                                      env  zone TCPIP$TZ
                                      env  zone MULTINET_TIMEZONE
                                      env  offset SYS$TIMEZONE_DIFFERENTIAL
                                      gmtoff
                                    ),
                                  ];

   } else {
      $$self{'data'}{'methods'} = [
                                   qw(main TZ
                                      env  zone TZ
                                      gmtoff
                                    ),
                                  ];
   }
}

sub _init_final {
   my($self) = @_;

   $self->_set_curr_zone();
}

no strict 'refs';
# This loads data from an offset module
#
sub _offmod {
   my($self,$offset) = @_;
   return  if (exists $$self{'data'}{'Offsets'}{$offset});

   my $mod  = $$self{'data'}{'Offmod'}{$offset};
   eval "require Date::Manip::Offset::${mod}";
   my %off  = %{ "Date::Manip::Offset::${mod}::Offset" };

   $$self{'data'}{'Offsets'}{$offset} = { %off };
}

# This loads data from a zone module (takes a lowercase zone)
#
sub _module {
   my($self,$zone) = @_;
   return  if (exists $$self{'data'}{'Zones'}{$zone}{'Loaded'});

   my $mod   = $$self{'data'}{'Module'}{$zone};
   eval "require Date::Manip::TZ::${mod}";
   my %dates = %{ "Date::Manip::TZ::${mod}::Dates" };
   my %last  = %{ "Date::Manip::TZ::${mod}::LastRule" };
   $$self{'data'}{'Zones'}{$zone} =
     {
      'Dates'    => { %dates },
      'LastRule' => { %last },
      'Loaded'   => 1
     };
}
use strict 'refs';

########################################################################
# CHECKING/MODIFYING ZONEINFO DATA
########################################################################

sub _zone {
   my($self,$zone) = @_;
   $zone = lc($zone);

   if (exists $$self{'data'}{'MyAlias'}{$zone}) {
      return $$self{'data'}{'MyAlias'}{$zone};
   } elsif (exists $$self{'data'}{'Alias'}{$zone}) {
      return  $$self{'data'}{'Alias'}{$zone};
   } else {
      return '';
   }
}

sub tzdata {
   my($self) = @_;
   return $Date::Manip::Zones::TzdataVersion;
}

sub tzcode {
   my($self) = @_;
   return $Date::Manip::Zones::TzcodeVersion;
}

sub define_alias {
   my($self,$alias,$zone) = @_;
   $alias = lc($alias);

   if ($alias eq 'reset') {
      $$self{'data'}{'MyAlias'} = {};
      $$self{'data'}{'zonerx'}  = undef;
      return 0;
   }
   if (lc($zone) eq 'reset') {
      delete $$self{'data'}{'MyAlias'}{$alias};
      $$self{'data'}{'zonerx'} = undef;
      return 0;
   }

   $zone  = $self->_zone($zone);

   return 1  if (! $zone);
   $$self{'data'}{'MyAlias'}{$alias} = $zone;
   $$self{'data'}{'zonerx'} = undef;
   return 0;
}

sub define_abbrev {
   my($self,$abbrev,@zone) = @_;
   $abbrev = lc($abbrev);

   if ($abbrev eq 'reset') {
      $$self{'data'}{'MyAbbrev'} = {};
      $$self{'data'}{'abbrx'}    = undef;
      return 0;
   }
   if ($#zone == 0  &&  lc($zone[0]) eq 'reset') {
      delete $$self{'data'}{'MyAbbrev'}{$abbrev};
      $$self{'data'}{'abbrx'} = undef;
      return (0);
   }

   if (! exists $$self{'data'}{'Abbrev'}{$abbrev}) {
      return (1);
   }

   my (@z,%z);
   my %zone = map { $_,1 } @{ $$self{'data'}{'Abbrev'}{$abbrev} };
   foreach my $z (@zone) {
      my $zone = $self->_zone($z);
      return (2,$z)  if (! $zone);
      return (3,$z)  if (! exists $zone{$zone});
      next  if (exists $z{$zone});
      $z{$zone} = 1;
      push(@z,$zone);
   }

   $$self{'data'}{'MyAbbrev'}{$abbrev} = [ @z ];
   $$self{'data'}{'abbrx'}             = undef;
   return ();
}

sub define_offset {
   my($self,$offset,@args) = @_;
   my $dmb                 = $$self{'base'};

   if (lc($offset) eq 'reset') {
      $$self{'data'}{'MyOffsets'} = {};
      return (0);
   }
   if ($#args == 0  &&  lc($args[0]) eq 'reset') {
      delete $$self{'data'}{'MyOffsets'}{$offset};
      return (0);
   }

   # Check that $offset is valid. If it is, load the
   # appropriate module.

   if (ref($offset)) {
      $offset = $dmb->join('offset',$offset);
   } else {
      $offset = $dmb->_delta_convert('offset',$offset);
   }
   return (9)  if (! $offset);
   return (1)  if (! exists $$self{'data'}{'Offmod'}{$offset});

   $self->_offmod($offset);

   # Find out whether we're handling STD, DST, or both.

   my(@isdst) = (0,1);
   if ($args[0] =~ /^std|dst|stdonly|dstonly$/i) {
      my $tmp = lc(shift(@args));
      if ($tmp eq 'stdonly') {
         @isdst = (0);
      } elsif ($tmp eq 'dstonly') {
         @isdst = (1);
      }
   }
   my @zone = @args;

   if ($#isdst == 0  &&
       ! exists($$self{'data'}{'Offsets'}{$offset}{$isdst[0]})) {
      return (2);
   }

   # Check to see that each zone is valid, and contains this offset.

   my %tmp;
   foreach my $isdst (0,1) {
      next  if (! exists $$self{'data'}{'Offsets'}{$offset}{$isdst});
      my @z = @{ $$self{'data'}{'Offsets'}{$offset}{$isdst} };
      $tmp{$isdst} = { map { $_,1 } @z };
   }

   foreach my $z (@zone) {
      my $lcz = lc($z);
      if (! exists $$self{'data'}{'ZoneNames'}{$lcz}) {
         return (3,$z);
      } elsif (! exists $tmp{0}{$lcz}  &&
               ! exists $tmp{1}{$lcz}) {
         return (4,$z);
      } elsif ($#isdst == 0  &&
               ! exists $tmp{$isdst[0]}{$lcz}) {
         return (5,$z);
      }
      $z = $lcz;
   }

   # Set the zones accordingly.

   foreach my $isdst (@isdst) {
      my @z;
      foreach my $z (@zone) {
         push(@z,$z)  if (exists $tmp{$isdst}{$z});
      }
      $$self{'data'}{'MyOffsets'}{$offset}{$isdst} = [ @z ];
   }

   return (0);
}

########################################################################
# SYSTEM ZONE
########################################################################

sub curr_zone {
   my($self,$reset) = @_;
   my $dmb = $$self{'base'};

   if ($reset) {
      $self->_set_curr_zone();
   }

   my($ret) = $self->_now('systz',1);
   return $$self{'data'}{'ZoneNames'}{$ret}
}

sub curr_zone_methods {
   my($self,@methods) = @_;

   if (${^TAINT}) {
      warn "ERROR: [curr_zone_methods] not allowed when taint checking on\n";
      return;
   }

   $$self{'data'}{'methods'}  = [ @methods ];
}

sub _set_curr_zone {
   my($self) = @_;
   my $dmb   = $$self{'base'};
   my $currzone = $self->_get_curr_zone();

   $$dmb{'data'}{'now'}{'systz'} = $self->_zone($currzone);
}

# This determines the system timezone using all of the methods
# applicable to the operating system. The first match is used.
#
sub _get_curr_zone {
   my($self) = @_;
   my $dmb   = $$self{'base'};

   my $t = time;
   my($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = localtime($t);
   my $currzone = '';
   my $dstflag = ($isdst ? 'dstonly' : 'stdonly');

   my (@methods) = @{ $$self{'data'}{'methods'} };
   my $debug     = ($ENV{DATE_MANIP_DEBUG} ? 1 : 0);

   defined $$self{'data'}{'path'}
     and local $ENV{PATH} = $$self{'data'}{'path'};

   METHOD:
   while (@methods) {
      my $method = shift(@methods);
      my @zone   = ();

      if ($method eq 'main') {

         if (! @methods) {
            warn "ERROR: [_set_curr_zone] main requires argument\n";
            return;
         }
         my $var = shift(@methods);
         push(@zone,$$::var)  if (defined $$::var);

         if ($debug) {
            print "*** DEBUG ***  main $var = " .
                  (defined $$::var ? $$::var : 'undef') . "\n";
         }

      } elsif ($method eq 'env') {
         if (@methods < 2) {
            warn "ERROR: [_set_curr_zone] env requires 2 argument\n";
            return;
         }
         my $type = lc( shift(@methods) );
         if ($type ne 'zone'  &&
             $type ne 'offset') {
            warn "ERROR: [_set_curr_zone] env requires 'offset' or 'zone' as the first argument\n";
            return;
         }
         my $var  = shift(@methods);
         if (exists $ENV{$var}) {
            if ($type eq 'zone') {
               push(@zone,$ENV{$var});
            } else {
               my $off = $ENV{$var};
               $off    = $dmb->_delta_convert('time',"0:0:$off");
               $off    = $dmb->_delta_convert('offset',$off);
               push(@zone,$off);
            }
         }

         if ($debug) {
            print "*** DEBUG *** env $type $var ";
            if (exists $ENV{$var}) {
               print $ENV{$var};
               print $zone[$#zone]  if ($type eq 'offset');
               print "\n";
            } else {
               print "-no result-\n";
            }
         }

      } elsif ($method eq 'file') {
         if (! @methods) {
            warn "ERROR: [_set_curr_zone] file requires argument\n";
            return;
         }
         my $file = shift(@methods);
         next  if (! -f $file);

         my $in = new IO::File;
         $in->open($file)  ||  next;
         my $firstline = 1;

         my @z;
         while (! $in->eof) {
            my $line = <$in>;
            next  if ($line =~ /^\s*\043/  ||
                      $line =~ /^\s*$/);

            # We're looking for lines of the form:
            #   TZ = string
            #   TIMEZONE = string
            #   ZONE = string
            #
            # 'string' can be:
            #   the name of a timezone enclosed in single/double quotes
            #   with everything after the closing quote ignored (the
            #   name of the timezone may have spaces instead of underscores)
            #
            #   a space delimited list of tokens, the first of which
            #   is the time zone
            #
            #   the name of a timezone with underscores replaced by
            #   spaces and nothing after the timezone
            #
            # For some reason, RHEL6 desktop version stores timezones as
            #   America/New York
            # instead of
            #   America/New_York
            # which is why we have to handle the space/underscore
            # substitution.

            if ($line =~ /^\s*(?:TZ|TIMEZONE|ZONE)\s*=\s*(.*)\s*$/) {
               my $val  = $1;
               @z       = ();
               last  if (! $val);

               if ($val =~ /^(["'])(.*?)\1/) {
                  my $z = $2;
                  last  if (! $z);
                  $z    =~ s/\s+/_/g;
                  push(@zone,$z);

               } elsif ($val =~ /\s/) {
                  $val  =~ /^(\S+)/;
                  push(@zone,$1);
                  $val  =~ s/\s+/_/g;
                  push(@zone,$val);

               } else {
                  push(@zone,$val);
               }

               last;
            }
            if ($firstline) {
               $firstline = 0;
               $line      =~ s/^\s*//;
               $line      =~ s/\s*$//;
               $line      =~ s/["']//g;  # "
               $line      =~ s/\s+/_/g;
               push(@z,$line);
            }
         }
         close(IN);

         push(@zone,@z)  if (@z);

         if ($debug) {
            print "*** DEBUG *** file $file\n";
            if (@z) {
               print "              @z\n";
            } else {
               print "              -no result-\n";
            }
         }

      } elsif ($method eq 'command') {
         if (! @methods) {
            warn "ERROR: [_set_curr_zone] command requires argument\n";
            return;
         }
         my $command = shift(@methods);
         my ($out)   = _cmd($command);
         push(@zone,$out)  if ($out);

         if ($debug) {
            print "*** DEBUG *** command $command\n";
            if ($out) {
               print "              $out\n";
            } else {
               print "              -no result-\n";
            }
         }

      } elsif ($method eq 'cmdfield') {
         if ($#methods < 1) {
            warn "ERROR: [_set_curr_zone] cmdfield requires 2 arguments\n";
            return;
         }
         my $command = shift(@methods);
         my $n       = shift(@methods);
         my ($out)   = _cmd($command);
         my @z;

         if ($out) {
            $out    =~ s/^\s*//;
            $out    =~ s/\s*$//;
            my @out = split(/\s+/,$out);
            push(@z,$out[$n])  if (defined $out[$n]);
         }

         push(@zone,@z)  if (@z);

         if ($debug) {
            print "*** DEBUG *** cmdfield $command $n\n";
            if (@z) {
               print "              @z\n";
            } else {
               print "              -no result-\n";
            }
         }

      } elsif ($method eq 'gmtoff') {
         my($secUT,$minUT,$hourUT,$mdayUT,$monUT,$yearUT,$wdayUT,$ydayUT,
            $isdstUT) = gmtime($t);
         if ($mdayUT>($mday+1)) {
            # UT = 28-31   LT = 1
            $mdayUT=0;
         } elsif ($mdayUT<($mday-1)) {
            # UT = 1       LT = 28-31
            $mday=0;
         }
         $sec    = (($mday*24   + $hour)*60   + $min)*60 + $sec;
         $secUT  = (($mdayUT*24 + $hourUT)*60 + $minUT)*60 + $secUT;
         my $off = $sec-$secUT;

         $off    = $dmb->_delta_convert('time',"0:0:$off");
         $off    = $dmb->_delta_convert('offset',$off);
         push(@zone,$off);

         if ($debug) {
            print "*** DEBUG *** gmtoff $off\n";
         }

      } elsif ($method eq 'registry') {
         my $z = $self->_windows_registry_val();
         push(@zone,$z)  if ($z);

         if ($debug) {
            print "*** DEBUG *** registry $z\n";
         }

      } else {
         warn "ERROR: [_set_curr_zone] invalid method: $method\n";
         return;
      }

      foreach my $zone (@zone) {
         $zone = lc($zone);
         # OpenUNIX puts a colon at the start
         $zone =~ s/^://;

         # If we got a zone name/alias
         $currzone = $self->_zone($zone);
         last METHOD  if ($currzone);

         # If we got an abbreviation (EST)
         if (exists $$self{'data'}{'Abbrev'}{$zone}) {
            $currzone = $$self{'data'}{'Abbrev'}{$zone}[0];
            last METHOD;
         }

         # If we got an offset

         $currzone = $self->zone($zone,$dstflag);
         last METHOD  if ($currzone);
      }
   }

   if (! $currzone) {
      warn "ERROR: Date::Manip unable to determine Time Zone.\n";
      die;
   }

   return $currzone;
}

# This comes from the DateTime-TimeZone module
#
sub _windows_registry_val {
   my($self) = @_;

   require Win32::TieRegistry;

   my $lmachine = new Win32::TieRegistry 'LMachine',
                      { Access => Win32::TieRegistry::KEY_READ(),
                        Delimiter => '/' }
      or return '';

   my $tzinfo = $lmachine->Open('SYSTEM/CurrentControlSet/Control/TimeZoneInformation/');

   #
   # Windows Vista, Windows 2008 Server
   #

   my $tzkn = $tzinfo->GetValue('TimeZoneKeyName');
   if (defined($tzkn)  &&  $tzkn) {
      # For some reason, Vista is tacking on a bunch of stuff at the
      # end of the timezone, starting with a chr(0). Strip it off.

      my $c = chr(0);
      my $i = index($tzkn,$c);
      if ($i != -1) {
         $tzkn = substr($tzkn,0,$i);
      }
      my $z = $self->_zone($tzkn);
      return $z  if ($z);
   }

   #
   # Windows NT, Windows 2000, Windows XP, Windows 2003 Server
   #

   my $stdnam = $tzinfo->GetValue('StandardName');
   my $z = $self->_zone($stdnam);
   return $z  if ($z);

   #
   # For non-English versions, we have to determine which timezone it
   # actually is.
   #

   my $atz = $lmachine->Open('SOFTWARE/Microsoft/Windows NT/CurrentVersion/Time Zones/');
   if (! defined($atz)  ||  ! $atz) {
      $atz = $lmachine->Open('SOFTWARE/Microsoft/Windows/CurrentVersion/Time Zones/');
   }

   return ""  if (! defined($atz)  ||  ! $atz);

   foreach my $z ($atz->SubKeyNames()) {
      my $tmp  = $atz->Open("$z/");
      my $znam = $tmp->GetValue('Std');
      return $z  if ($znam eq $stdnam);
   }
}

# We will be testing commands that don't exist on all architectures,
# so disable warnings.
#
no warnings;
sub _cmd {
   my($cmd) = @_;
   local(*IN);
   open(IN,"$cmd |")  ||  return ();
   my @out  = <IN>;
   close(IN);
   chomp(@out);
   return @out;
}
use warnings;

########################################################################
# DETERMINING A TIMEZONE
########################################################################

sub zone {
   my($self,@args) = @_;
   my $dmb         = $$self{'base'};
   if (! @args) {
      my($tz) = $self->_now('tz',1);
      return $$self{'data'}{'ZoneNames'}{$tz}
   }

   # Parse the arguments

   my($zone,$abbrev,$offset,$dstflag) = ('','','','');
   my(@abbrev,$date,$tmp);
   foreach my $arg (@args) {

      if (ref($arg) eq 'ARRAY') {
         if ($#$arg == 5) {
            # [Y,M,D,H,Mn,S]
            return undef  if ($date);
            $date = $arg;

         } elsif ($#$arg == 2) {
            # [H,Mn,S]
            return undef  if ($offset);
            $offset = $dmb->join('offset',$arg);
            return undef  if (! $offset);

         } else {
            return undef;
         }

      } elsif (ref($arg)) {
         return undef;

      } else {
         $arg = lc($arg);

         if ($arg =~ /^(std|dst|stdonly|dstonly)$/) {
            return undef  if ($dstflag);
            $dstflag = $arg;

         } elsif ($tmp = $self->_zone($arg)) {
            return undef  if ($zone);
            $zone = $tmp;

         } elsif (exists $$self{'data'}{'MyAbbrev'}{$arg}) {
            return undef  if (@abbrev);
            $abbrev = $arg;
            @abbrev = @{ $$self{'data'}{'MyAbbrev'}{$arg} };
         } elsif (exists $$self{'data'}{'Abbrev'}{$arg}) {
            return undef  if (@abbrev);
            $abbrev = $arg;
            @abbrev = @{ $$self{'data'}{'Abbrev'}{$arg} };

         } elsif ($tmp = $dmb->split('offset',$arg)) {
            return undef  if ($offset);
            $offset = $dmb->_delta_convert('offset',$arg);

         } elsif ($tmp = $dmb->split('date',$arg)) {
            return undef  if ($date);
            $date = $tmp;

         } else {
            return undef;
         }
      }
   }

   #
   # Determine the zones that match all data.
   #

   my @zone;

   while (1) {

      # No information

      if (! $zone  &&
          ! $abbrev  &&
          ! $offset) {
         my($z) = $self->_now('tz',1);
         @zone = (lc($z));
      }

      # $dstflag
      #
      # $dstflag is "dst' if
      #    zone is passed in as an offset
      #    date is passed in

      $dstflag = "dst"  if ($offset  &&  $date  &&  ! $dstflag);

      my(@isdst);
      if      ($dstflag eq 'stdonly') {
         @isdst = (0);
      } elsif ($dstflag eq 'dstonly') {
         @isdst = (1);
      } elsif ($dstflag eq 'dst') {
         @isdst = (1,0);
      } else {
         @isdst = (0,1);
      }

      # $zone

      if ($zone) {
         @zone = ($zone);
      }

      # $abbrev

      if ($abbrev) {
         my @z;
         foreach my $isdst (@isdst) {
            my @tmp = $self->_check_abbrev_isdst($abbrev,$isdst,@abbrev);
            if (@tmp) {
               if (@z) {
                  @z = _list_add(\@z,\@tmp);
               } else {
                  @z = @tmp;
               }
            }
         }

         if (@zone) {
            @zone = _list_union(\@z,\@zone);
         } else {
            @zone = @z;
         }
         last  if (! @zone);
      }

      # $offset

      if ($offset) {
         return undef  if (! exists $$self{'data'}{'Offmod'}{$offset});
         $self->_offmod($offset);

         my @z;
         foreach my $isdst (@isdst) {
            my @tmp;
            if      (exists $$self{'data'}{'MyOffsets'}{$offset}{$isdst}) {
               @tmp = @{ $$self{'data'}{'MyOffsets'}{$offset}{$isdst} };
            } elsif (exists $$self{'data'}{'Offsets'}{$offset}{$isdst}) {
               @tmp = @{ $$self{'data'}{'Offsets'}{$offset}{$isdst} };
            }
            @tmp = $self->_check_offset_abbrev_isdst($offset,$abbrev,$isdst,@tmp)
              if ($abbrev);
            if (@tmp) {
               if (@z) {
                  @z = _list_add(\@z,\@tmp);
               } else {
                  @z = @tmp;
               }
            }
         }

         if (@zone) {
            @zone = _list_union(\@zone,\@z);
         } else {
            @zone = @z;
         }
         last  if (! @zone);
      }

      # $date

      if ($date) {
         # Get all periods for the year.
         #
         # Test all periods to make sure that $date is between the
         # wallclock times AND matches other criteria. All periods
         # must be tested since the same wallclock time can be in
         # multiple periods.

         my @tmp;
         my $isdst = '';
         $isdst    = 0  if ($dstflag eq 'stdonly');
         $isdst    = 1  if ($dstflag eq 'dstonly');

         ZONE:
         foreach my $z (@zone) {
            $self->_module($z);
            my $y       = $$date[0];
            my @periods = $self->_all_periods($z,$y);

            foreach my $period (@periods) {
               my($begUT,$begLT,$off,$offref,$abb,$dst,$endUT,$endLT) = @$period;
               next  if ($dmb->cmp($date,$begLT) == -1  ||
                         $dmb->cmp($date,$endLT) == 1 ||
                         ($offset ne ''  &&  $offset ne $off)  ||
                         ($isdst  ne ''  &&  $isdst  ne $dst)  ||
                         ($abbrev ne ''  &&  lc($abbrev) ne lc($abb))
                        );
               push(@tmp,$z);
               next ZONE;
            }
         }
         @zone = @tmp;
         last  if (! @zone);
      }

      last;
   }

   # Return the value/list

   if (wantarray) {
      my @ret;
      foreach my $z (@zone) {
         push(@ret,$$self{'data'}{'ZoneNames'}{$z});
      }
      return @ret;
   }

   return '' if (! @zone);
   return $$self{'data'}{'ZoneNames'}{$zone[0]}
}

# This returns a list of all timezones which have the correct
# abbrev/isdst combination.
#
sub _check_abbrev_isdst {
   my($self,$abbrev,$isdst,@zones) = @_;

   my @ret;
   ZONE:
   foreach my $zone (@zones) {
      $self->_module($zone);

      foreach my $y (sort keys %{ $$self{'data'}{'Zones'}{$zone}{'Dates'} }) {
         my @periods = @{ $$self{'data'}{'Zones'}{$zone}{'Dates'}{$y} };
         foreach my $period (@periods) {
            my($dateUT,$dateLT,$off,$offref,$abb,$dst,$endUT,$endLT) = @$period;
            next  if (lc($abbrev)  ne lc($abb)  ||
                      $isdst != $dst);
            push(@ret,$zone);
            next ZONE;
         }
      }
   }

   return @ret;
}

# This returns a list of all timezones which have the correct
# abbrev/isdst combination.
#
sub _check_offset_abbrev_isdst {
   my($self,$offset,$abbrev,$isdst,@zones) = @_;

   my @ret;
 ZONE: foreach my $zone (@zones) {
      $self->_module($zone);

      foreach my $y (sort keys %{ $$self{'data'}{'Zones'}{$zone}{'Dates'} }) {
         my @periods = @{ $$self{'data'}{'Zones'}{$zone}{'Dates'}{$y} };
         foreach my $period (@periods) {
            my($dateUT,$dateLT,$off,$offref,$abb,$dst,$endUT,$endLT) = @$period;
            next  if (lc($abbrev)  ne lc($abb)  ||
                      $offset ne $off  ||
                      $isdst != $dst);
            push(@ret,$zone);
            next ZONE;
         }
      }
   }

   return @ret;
}

# This finds the elements common to two lists, and preserves the order
# from the first list.
#
sub _list_union {
   my($list1,$list2) = @_;
   my(%list2) = map { $_,1 } @$list2;
   my(@ret);
   foreach my $ele (@$list1) {
      push(@ret,$ele)  if (exists $list2{$ele});
   }
   return @ret;
}

# This adds elements from the second list to the first list, provided
# they are not already there.
#
sub _list_add {
   my($list1,$list2) = @_;
   my(%list1) = map { $_,1 } @$list1;
   my(@ret) = @$list1;
   foreach my $ele (@$list2) {
      next  if (exists $list1{$ele});
      push(@ret,$ele);
      $list1{$ele} = 1;
   }
   return @ret;
}

########################################################################
# PERIODS METHODS
########################################################################

sub all_periods {
   my($self,$zone,$year) = @_;

   my $z = $self->_zone($zone);
   if (! $z) {
      warn "ERROR: [periods] Invalid zone: $zone\n";
      return;
   }
   $zone = $z;
   $self->_module($zone);

   return $self->_all_periods($zone,$year);
}

sub _all_periods {
   my($self,$zone,$year) = @_;
   $year += 0;

   if (! exists $$self{'data'}{'Zones'}{$zone}{'AllDates'}{$year}) {

      #
      # $ym1 is the year prior to $year which contains a rule (which will
      # end in $year or later). $y is $year IF the zone contains rules
      # for this year.
      #

      my($ym1,$ym0);
      if ($year > $$self{'data'}{'LastYear'}  &&
          exists $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'zone'}) {
         $ym1 = $year-1;
         $ym0 = $year;

      } else {
         foreach my $y (sort { $a <=> $b }
                        keys %{ $$self{'data'}{'Zones'}{$zone}{'Dates'} }) {
            if ($y < $year) {
               $ym1 = $y;
               next;
            }
            $ym0 = $year  if ($year == $y);
            last;
         }
      }
      $ym1 = 0  if (! $ym1);

      #
      # Get the periods from the prior year.  The last one is used (any others
      # are discarded).
      #

      my(@periods);

      # $ym1 will be 0 in 0001
      if ($ym1) {
         my @tmp = $self->_periods($zone,$ym1);
         push(@periods,pop(@tmp))  if (@tmp);
      }

      #
      # Add on any periods from the current year.
      #

      if ($ym0) {
         push(@periods,$self->_periods($zone,$year));
      }

      $$self{'data'}{'Zones'}{$zone}{'AllDates'}{$year} = [ @periods ];
   }

   # A faster 'dclone' so we don't return the actual data
   my @ret;
   foreach my $ele (@{ $$self{'data'}{'Zones'}{$zone}{'AllDates'}{$year} }) {
      push(@ret,
           [ [ @{$$ele[0]} ],[ @{$$ele[1]} ],$$ele[2],[ @{$$ele[3]} ],$$ele[4],$$ele[5],
             [ @{$$ele[6]} ],[ @{$$ele[7]} ],$$ele[8],$$ele[9],$$ele[10],$$ele[11] ]);
   }
   return @ret;
}

sub periods {
   my($self,$zone,$year,$year1) = @_;

   my $z = $self->_zone($zone);
   if (! $z) {
      warn "ERROR: [periods] Invalid zone: $zone\n";
      return;
   }
   $zone = $z;
   $self->_module($zone);

   if (! defined($year1)) {
      return $self->_periods($zone,$year);
   }

   $year = 1  if (! defined($year));

   my @ret;
   my $lastyear = $$self{'data'}{'LastYear'};

   if ($year <= $lastyear) {
      foreach my $y (sort { $a <=> $b }
                     keys %{ $$self{'data'}{'Zones'}{$zone}{'Dates'} }) {
         last  if ($y > $year1  ||  $y > $lastyear);
         next  if ($y < $year);
         push(@ret,$self->_periods($zone,$y));
      }
   }

   if ($year1 > $lastyear) {
      $year = $lastyear + 1  if ($year <= $lastyear);
      foreach my $y ($year..$year1) {
         push(@ret,$self->_periods($zone,$y));
      }
   }

   return @ret;
}

sub _periods {
   my($self,$zone,$year) = @_;
   $year += 0;

   if (! exists $$self{'data'}{'Zones'}{$zone}{'Dates'}{$year}) {

      my @periods = ();
      if ($year > $$self{'data'}{'LastYear'}) {
         # Calculate periods using the LastRule method
         @periods = $self->_lastrule($zone,$year);
      }

      $$self{'data'}{'Zones'}{$zone}{'Dates'}{$year} = [ @periods ];
   }

   # A faster 'dclone' so we don't return the actual data
   my @ret;
   foreach my $ele (@{ $$self{'data'}{'Zones'}{$zone}{'Dates'}{$year} }) {
      push(@ret,
           [ [ @{$$ele[0]} ],[ @{$$ele[1]} ],$$ele[2],[ @{$$ele[3]} ],$$ele[4],$$ele[5],
             [ @{$$ele[6]} ],[ @{$$ele[7]} ],$$ele[8],$$ele[9],$$ele[10],$$ele[11] ]);
   }
   return @ret;
}

sub date_period {
   my($self,$date,$zone,$wallclock,$isdst) = @_;
   $wallclock = 0  if (! $wallclock);
   $isdst     = 0  if (! $isdst);

   my $z = $self->_zone($zone);
   if (! $z) {
      warn "ERROR: [date_period] Invalid zone: $zone\n";
      return;
   }
   $zone = $z;
   $self->_module($zone);

   my $dmb  = $$self{'base'};
   my @date = @$date;
   my $year = $date[0];
   my $dates= $dmb->_date_fields(@$date);

   if ($wallclock) {
      # A wallclock date

      my @period = $self->_all_periods($zone,$year);
      my $beg    = $period[0]->[9];
      my $end    = $period[-1]->[11];
      if      (($dates cmp $beg) == -1) {
         @period = $self->_all_periods($zone,$year-1);
      } elsif (($dates cmp $end) == 1) {
         @period = $self->_all_periods($zone,$year+1);
      }

      my(@per);
      foreach my $period (@period) {
         my($begUT,$begLT,$offsetstr,$offset,$abbrev,$dst,$endUT,$endLT,
            $begUTs,$begLTs,$endUTs,$endLTs) = @$period;
         if (($dates cmp $begLTs) != -1  &&  ($dates cmp $endLTs) != 1) {
            push(@per,$period);
         }
      }

      if ($#per == -1) {
         return ();
      } elsif ($#per == 0) {
         return $per[0];
      } elsif ($#per == 1) {
         if ($per[0][5] == $isdst) {
            return $per[0];
         } else {
            return $per[1];
         }
      } else {
         warn "ERROR: [date_period] Impossible error\n";
         return;
      }

   } else {
      # A GMT date

      my @period = $self->_all_periods($zone,$year);
      foreach my $period (@period) {
         my($begUT,$begLT,$offsetstr,$offset,$abbrev,$isdst,$endUT,$endLT,
            $begUTs,$begLTs,$endUTs,$endLTs) = @$period;
         if (($dates cmp $begUTs) != -1  &&  ($dates cmp $endUTs) != 1) {
            return $period;
         }
      }
      warn "ERROR: [date_period] Impossible error\n";
      return;
   }
}

# Calculate critical dates from the last rule. If $endonly is passed
# in, it only calculates the ending of the zone period before the
# start of the first one. This is necessary so that the last period in
# one year can find out when it ends (which is determined in the
# following year).
#
# Returns:
#   [begUT, begLT, offsetstr, offset, abb, ISDST, endUT, endLT,
#    begUTstr, begLTstr, endUTstr, endLTstr]
# for each.
#
sub _lastrule {
   my($self,$zone,$year,$endonly) = @_;

   #
   # Get the list of rules (actually, the month in which the
   # rule triggers a time change). If there are none, then
   # this zone doesn't have a LAST RULE.
   #

   my @mon = (sort keys
              %{ $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'} });
   return ()  if (! @mon);

   #
   # Analyze each time change.
   #

   my @dates = ();
   my $dmb   = $$self{'base'};

   my $stdoff = $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'zone'}{'stdoff'};
   my $dstoff = $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'zone'}{'dstoff'};

   my (@period);

   foreach my $mon (@mon) {
      my $flag =
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'flag'};
      my $dow  =
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'dow'};
      my $num  =
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'num'};
      my $isdst=
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'isdst'};
      my $time =
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'time'};
      my $type =
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'type'};
      my $abb  =
        $$self{'data'}{'Zones'}{$zone}{'LastRule'}{'rules'}{$mon}{'abb'};

      # The end of the current period and the beginning of the next
      my($endUT,$endLT,$begUT,$begLT) =
        $dmb->_critical_date($year,$mon,$flag,$num,$dow,
                             $isdst,$time,$type,$stdoff,$dstoff);
      return ($endUT,$endLT)  if ($endonly);

      if (@period) {
         push(@period,$endUT,$endLT);
         push(@dates,[@period]);
      }
      my $offsetstr = ($isdst ? $dstoff : $stdoff);
      my $offset    = $dmb->split('offset',$offsetstr);

      @period = ($begUT,$begLT,$offsetstr,$offset,$abb,$isdst);
   }

   push(@period,$self->_lastrule($zone,$year+1,1));
   push(@dates,[@period]);

   foreach my $period (@dates) {
      my($begUT,$begLT,$offsetstr,$offset,$abbrev,$dst,$endUT,$endLT) = @$period;
      my $begUTstr = $dmb->join("date",$begUT);
      my $begLTstr = $dmb->join("date",$begLT);
      my $endUTstr = $dmb->join("date",$endUT);
      my $endLTstr = $dmb->join("date",$endLT);
      $period = [$begUT,$begLT,$offsetstr,$offset,$abbrev,$dst,$endUT,$endLT,
                 $begUTstr,$begLTstr,$endUTstr,$endLTstr];
   }

   return @dates;
}

########################################################################
# CONVERSION
########################################################################

sub convert {
   my($self,$date,$from,$to,$isdst) = @_;
   $self->_convert('convert',$date,$from,$to,$isdst);
}

sub convert_to_gmt {
   my($self,$date,@arg) = @_;
   my($err,$from,$isdst) = _convert_args('convert_to_gmt',@arg);
   return (1) if ($err);

   my $dmb = $$self{'base'};

   if (! $from) {
      $from = $self->_now('tz',1);
   }
   $self->_convert('convert_to_gmt',$date,$from,'GMT',$isdst);
}

sub convert_from_gmt {
   my($self,$date,@arg) = @_;
   my($err,$to,$isdst) = _convert_args('convert_from_gmt',@arg);
   return (1) if ($err);

   my $dmb = $$self{'base'};

   if (! $to) {
      $to = $self->_now('tz',1);
   }
   $self->_convert('convert_from_gmt',$date,'GMT',$to,$isdst);
}

sub convert_to_local {
   my($self,$date,@arg) = @_;
   my($err,$from,$isdst) = _convert_args('convert_to_local',@arg);
   return (1) if ($err);

   my $dmb = $$self{'base'};

   if (! $from) {
      $from = 'GMT';
   }
   $self->_convert('convert_to_local',$date,$from,$self->_now('tz',1),$isdst);
}

sub convert_from_local {
   my($self,$date,@arg) = @_;
   my($err,$to,$isdst) = _convert_args('convert_from_local',@arg);
   return (1) if ($err);

   my $dmb = $$self{'base'};

   if (! $to) {
      $to = 'GMT';
   }
   $self->_convert('convert_from_local',$date,$self->_now('tz',1),$to,$isdst);
}

sub _convert_args {
   my($caller,@args) = @_;

   if ($#args == -1) {
      return (0,'',0);
   } elsif ($#args == 0) {
      if ($args[0] eq '0'  ||
          $args[0] eq '1') {
         return (0,'',$args[0]);
      } else {
         return (0,$args[0],0);
      }
   } elsif ($#args == 1) {
      return (0,@args);
   } else {
      return (1,'',0);
   }
}

sub _convert {
   my($self,$caller,$date,$from,$to,$isdst) = @_;
   my $dmb = $$self{'base'};

   # Handle $date as a reference and a string
   my (@date);
   if (ref($date)) {
      @date = @$date;
   } else {
      @date = @{ $dmb->split('date',$date) };
      $date = [@date];
   }

   if ($from ne $to) {
      my $tmp = $self->_zone($from);
      if (! $tmp) {
         return (2);
      }
      $from = $tmp;

      $tmp = $self->_zone($to);
      if (! $tmp) {
         return (3);
      }
      $to = $tmp;
   }

   if ($from eq $to) {
      my $per = $self->date_period($date,$from,1,$isdst);
      my $offset = $$per[3];
      my $abb    = $$per[4];
      return (0,$date,$offset,$isdst,$abb);
   }

   # Convert $date from $from to GMT

   if ($from ne "Etc/GMT") {
      my $per = $self->date_period($date,$from,1,$isdst);
      if (! $per) {
         return (4);
      }
      my $offset = $$per[3];
      @date = @{ $dmb->calc_date_time(\@date,$offset,1) };
   }

   # Convert $date from GMT to $to

   $isdst     = 0;
   my $offset = [0,0,0];
   my $abb    = 'GMT';

   if ($to ne "Etc/GMT") {
      my $per    = $self->date_period([@date],$to,0);
      $offset    = $$per[3];
      $isdst     = $$per[5];
      $abb       = $$per[4];
      @date      = @{ $dmb->calc_date_time(\@date,$offset) };
   }

   return (0,[@date],$offset,$isdst,$abb);
}

########################################################################
# REGULAR EXPRESSIONS FOR TIMEZONE INFORMATION
########################################################################

# Returns a regular expression capable of matching all timezone names
# and aliases.
#
# The regular expression will have the following named matches:
#   zone  = a zone name or alias
#
sub _zonerx {
   my($self) = @_;
   return $$self{'data'}{'zonerx'}  if (defined $$self{'data'}{'zonerx'});
   my @zone  = (keys %{ $$self{'data'}{'Alias'} },
                keys %{ $$self{'data'}{'MyAlias'} });
   @zone     = sort _sortByLength(@zone);
   foreach my $zone (@zone) {
      $zone  =~ s/\057/\\057/g;   # /
      $zone  =~ s/\055/\\055/g;   # -
      $zone  =~ s/\056/\\056/g;   # .
      $zone  =~ s/\050/\\050/g;   # (
      $zone  =~ s/\051/\\051/g;   # )
      $zone  =~ s/\053/\\053/g;   # +
   }
   my $re    = join('|',@zone);
   $$self{'data'}{'zonerx'} = qr/(?<zone>$re)/i;
   return $$self{'data'}{'zonerx'};
}

# Returns a regular expression capable of matching all abbreviations.
#
# The regular expression will have the following named matches:
#   abb  = a zone abbreviation
#
sub _abbrx {
   my($self) = @_;
   return $$self{'data'}{'abbrx'}  if (defined $$self{'data'}{'abbrx'});
   my @abb  = (keys %{ $$self{'data'}{'Abbrev'} },
               keys %{ $$self{'data'}{'MyAbbrev'} });
   @abb     = sort _sortByLength(@abb);
   foreach my $abb (@abb) {
      $abb =~ s/\055/\\055/g;   # -
      $abb =~ s/\053/\\053/g;   # +
   }
   my $re    = join('|',@abb);
   $$self{'data'}{'abbrx'} = qr/(?<abb>$re)/i;
   return $$self{'data'}{'abbrx'};
}

# Returns a regular expression capable of matching a valid timezone as
# an offset. Known formats are:
#    +07              +07 (HST)
#    +0700            +0700 (HST)
#    +07:00           +07:00 (HST)
#    +070000          +070000 (HST)
#    +07:00:00        +07:00:00 (HST)
#
# The regular expression will have the following named matches:
#   off   = the offset
#   abb   = the abbreviation
#
# If $simple is passed in, it will return the simple form (i.e. no
# appended abbreviation).
#
sub _offrx {
   my($self,$simple) = @_;
   if ($simple) {
      return $$self{'data'}{'offsimprx'}  if (defined $$self{'data'}{'offsimprx'});
   } else {
      return $$self{'data'}{'offrx'}      if (defined $$self{'data'}{'offrx'});
   }

   my($hr) = qr/(?:[0-1][0-9]|2[0-3])/;  # 00 - 23
   my($mn) = qr/(?:[0-5][0-9])/;         # 00 - 59
   my($ss) = qr/(?:[0-5][0-9])/;         # 00 - 59
   my($abb)= $self->_abbrx();

   my($re) = qr/ (?<off> [+-] (?: $hr:$mn:$ss |
                                  $hr$mn$ss   |
                                  $hr:?$mn    |
                                  $hr
                              )
                 )
                 (?: \s* (?: \( $abb \) | $abb))? /ix;
   my($re2) = qr/ (?<off> [+-] (?: $hr:$mn:$ss |
                                   $hr$mn$ss   |
                                   $hr:?$mn    |
                                   $hr
                               )
                  ) /ix;
   my $simprx = qr/(?<tzstring>$re2)/;

   $$self{'data'}{'offsimprx'} = $simprx;
   $$self{'data'}{'offrx'} = $re;

   return $$self{'data'}{'offsimprx'}  if ($simple);
   return $$self{'data'}{'offrx'};
}

# Returns a regular expression capable of matching all timezone
# information available. It will match a full timezone, an
# abbreviation, or an offset/abbreviation combination. The regular
# expression will have the following named matches:
#    tzstring  = the full string matched
# in addition to the matches from the _zonerx, _abbrx, and _offrx
# functions.
#
sub _zrx {
   my($self,$simple) = @_;
   return $$self{'data'}{'zrx'}  if (defined $$self{'data'}{'zrx'});

   my $zonerx    = $self->_zonerx();          # (?<zone>america/new_york|...)
   my $zoneabbrx = $self->_abbrx();           # (?<abb>edt|est|...)
   my $zoneoffrx = $self->_offrx();           # (?<off>07:00) (?<abb>GMT)

   my $zrx       = qr/(?<tzstring>$zoneabbrx|$zoneoffrx|$zonerx)/;
   $$self{'data'}{'zrx'} = $zrx;
   return $zrx;
}

# This sorts from longest to shortest element
#
no strict 'vars';
sub _sortByLength {
  return (length $b <=> length $a);
}
use strict 'vars';

########################################################################
# CONFIG VARS
########################################################################

# This sets a config variable. It also performs all side effects from
# setting that variable.
#
sub _config_var_tz {
   my($self,$var,$val) = @_;

   if ($var eq 'tz') {
      my $err = $self->_config_var_setdate("now,$val",0);
      return  if ($err);
      $$self{'data'}{'sections'}{'conf'}{'forcedate'} = 0;
      $val = 1;

   } elsif ($var eq 'setdate') {
      my $err = $self->_config_var_setdate($val,0);
      return  if ($err);
      $$self{'data'}{'sections'}{'conf'}{'forcedate'} = 0;
      $val = 1;

   } elsif ($var eq 'forcedate') {
      my $err = $self->_config_var_setdate($val,1);
      return  if ($err);
      $$self{'data'}{'sections'}{'conf'}{'setdate'} = 0;
      $val = 1;

   } elsif ($var eq 'configfile') {
      $self->_config_file($val);
      return;
   }

   my $base = $$self{'base'};
   $$base{'data'}{'sections'}{'conf'}{$var} = $val;
   return;
}

sub _config_var_setdate {
   my($self,$val,$force) = @_;
   my $base = $$self{'base'};

   my $dstrx = qr/(?:,\s*(stdonly|dstonly|std|dst))?/i;
   my $zonrx = qr/,\s*(.+)/;
   my $da1rx = qr/(\d\d\d\d)(\d\d)(\d\d)(\d\d):(\d\d):(\d\d)/;
   my $da2rx = qr/(\d\d\d\d)\-(\d\d)\-(\d\d)\-(\d\d):(\d\d):(\d\d)/;
   my $time  = time;

   my($op,$date,$dstflag,$zone,@date,$offset,$abb);

   #
   # Parse the argument
   #

   if ($val =~ /^now${dstrx}${zonrx}$/oi) {
      # now,ZONE
      # now,DSTFLAG,ZONE
      #    Sets now to the system date/time but sets the timezone to be ZONE

      $op = 'nowzone';
      ($dstflag,$zone) = ($1,$2);

   } elsif ($val =~ /^zone${dstrx}${zonrx}$/oi) {
      # zone,ZONE
      # zone,DSTFLAG,ZONE
      #    Converts 'now' to the alternate zone

      $op = 'zone';
      ($dstflag,$zone) = ($1,$2);

   } elsif ($val =~ /^${da1rx}${dstrx}${zonrx}$/o  ||
            $val =~ /^${da2rx}${dstrx}${zonrx}$/o) {
      # DATE,ZONE
      # DATE,DSTFLAG,ZONE
      #    Sets the date and zone

      $op = 'datezone';
      my($y,$m,$d,$h,$mn,$s);
      ($y,$m,$d,$h,$mn,$s,$dstflag,$zone) = ($1,$2,$3,$4,$5,$6,$7,$8);
      $date = [$y,$m,$d,$h,$mn,$s];

   } elsif ($val =~ /^${da1rx}$/o  ||
            $val =~ /^${da2rx}$/o) {
      # DATE
      #    Sets the date in the system timezone

      $op = 'date';
      my($y,$m,$d,$h,$mn,$s) = ($1,$2,$3,$4,$5,$6);
      $date   = [$y,$m,$d,$h,$mn,$s];
      $zone   = $self->_now('systz',1);

   } elsif (lc($val) eq 'now') {
      # now
      #    Resets everything

      my $systz = $$base{'data'}{'now'}{'systz'};
      $base->_init_now();
      $$base{'data'}{'now'}{'systz'} = $systz;
      return 0;

   } else {
      warn "ERROR: [config_var] invalid SetDate/ForceDate value: $val\n";
      return 1;
   }

   $dstflag = 'std'  if (! $dstflag);

   #
   # Get the date we're setting 'now' to
   #

   if ($op eq 'nowzone') {
      # Use the system localtime

      my($s,$mn,$h,$d,$m,$y) = localtime($time);
      $y += 1900;
      $m++;
      $date = [$y,$m,$d,$h,$mn,$s];

   } elsif ($op eq 'zone') {
      # Use the system GMT time

      my($s,$mn,$h,$d,$m,$y) = gmtime($time);
      $y += 1900;
      $m++;
      $date = [$y,$m,$d,$h,$mn,$s];
   }

   #
   # Find out what zone was passed in. It can be an alias or an offset.
   #

   if ($zone) {
      my ($err,@args);
      push(@args,$date)  if ($date);
      push(@args,$zone);
      push(@args,$dstflag);

      $zone = $self->zone(@args);
      if (! $zone) {
         warn "ERROR: [config_var] invalid zone in SetDate: @args\n";
         return 1;
      }

   } else {
      $zone = $$base{'data'}{'now'}{'systz'};
   }

   #
   # Handle the zone
   #

   my($isdst,@isdst);
   if      ($dstflag eq 'std') {
      @isdst = (0,1);
   } elsif ($dstflag eq 'stdonly') {
      @isdst = (0);
   } elsif ($dstflag eq 'dst') {
      @isdst = (1,0);
   } else {
      @isdst = (1);
   }

   if ($op eq 'nowzone'  ||
       $op eq 'datezone' ||
       $op eq 'date') {

      # Check to make sure that the date can exist in this zone.
      my $per;
      foreach my $dst (@isdst) {
         next  if ($per);
         $per = $self->date_period($date,$zone,1,$dst);
      }

      if (! $per) {
         warn "ERROR: [config_var] invalid date: SetDate: $date, $zone\n";
         return 1;
      }
      $isdst  = $$per[5];
      $abb    = $$per[4];
      $offset = $$per[3];

   } elsif ($op eq 'zone') {

      # Convert to that zone
      my($err);
      ($err,$date,$offset,$isdst,$abb) = $self->convert_from_gmt($date,$zone);
      if ($err) {
         warn "ERROR: [config_var] invalid SetDate date/offset values: $date, $zone\n";
         return 1;
      }
   }

   #
   # Set NOW
   #

   $$base{'data'}{'now'}{'date'}   = $date;
   $$base{'data'}{'now'}{'tz'}     = $self->_zone($zone);
   $$base{'data'}{'now'}{'isdst'}  = $isdst;
   $$base{'data'}{'now'}{'abb'}    = $abb;
   $$base{'data'}{'now'}{'offset'} = $offset;

   #
   # Treate SetDate/ForceDate
   #

   if ($force) {
      $$base{'data'}{'now'}{'force'}   = 1;
      $$base{'data'}{'now'}{'set'}     = 0;
   } else {
      $$base{'data'}{'now'}{'force'}   = 0;
      $$base{'data'}{'now'}{'set'}     = 1;
      $$base{'data'}{'now'}{'setsecs'} = $time;
      my($err,$setdate)                = $self->convert_to_gmt($date,$zone);
      $$base{'data'}{'now'}{'setdate'} = $setdate;
   }

   return 0;
}

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
