package Date::Manip::TZdata;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

###############################################################################
require 5.010000;
use IO::File;
use Date::Manip::Base;

use strict;
use integer;
use warnings;

our $VERSION;
$VERSION='6.47';
END { undef $VERSION; }

###############################################################################
# GLOBAL VARIABLES
###############################################################################

our ($Verbose,@StdFiles,$dmb);
END {
   undef $Verbose;
   undef @StdFiles;
   undef $dmb;
}
$dmb          = new Date::Manip::Base;

# Whether to print some debugging stuff.

$Verbose      = 0;

# Standard tzdata files that need to be parsed.

@StdFiles = qw(africa
               antarctica
               asia
               australasia
               europe
               northamerica
               pacificnew
               southamerica
               etcetera
               backward
              );

our ($TZ_DOM,$TZ_LAST,$TZ_GE,$TZ_LE);
END {
   undef $TZ_DOM;
   undef $TZ_LAST;
   undef $TZ_GE;
   undef $TZ_LE;
}

$TZ_DOM       = 1;
$TZ_LAST      = 2;
$TZ_GE        = 3;
$TZ_LE        = 4;

our ($TZ_STANDARD,$TZ_RULE,$TZ_OFFSET);
END {
   undef $TZ_STANDARD;
   undef $TZ_RULE;
   undef $TZ_OFFSET;
}
$TZ_STANDARD  = 1;
$TZ_RULE      = 2;
$TZ_OFFSET    = 3;

###############################################################################
# BASE METHODS
###############################################################################
#
# The Date::Manip::TZdata object is a hash of the form:
#
# { dir       => DIR          where to find the tzdata directory
#   zone      => { ZONE  => [ ZONEDESC ] }
#   ruleinfo  => { INFO  => [ VAL ... ] }
#   zoneinfo  => { INFO  => [ VAL ... ] }
#   zonelines => { ZONE  => [ VAL ... ] }
# }

sub new {
  my($class,$dir) = @_;

  $dir = '.'  if (! $dir);

  if (! -d "$dir/tzdata") {
     die "ERROR: no tzdata directory found\n";
  }

  my $self = {
              'dir'       => $dir,
              'zone'      => {},
              'ruleinfo'  => {},
              'zoneinfo'  => {},
              'zonelines' => {},
             };
  bless $self, $class;

  $self->_tzd_ParseFiles();

  return $self;
}

###############################################################################
# RULEINFO
###############################################################################

my($Error);

# @info = $tzd->ruleinfo($rule,@args);
#
# This takes the name of a set of rules (e.g. NYC or US as defined in
# the zoneinfo database) and returns information based on the arguments
# given.
#
#    @args
#    ------------
#
#    rules YEAR   : Return a list of all rules used during that year
#    stdlett YEAR : The letter(s) used during standard time that year
#    savlett YEAR : The letter(s) used during saving time that year
#    lastoff YEAR : Returns the last DST offset of the year
#    rdates YEAR  : Returns a list of critical dates for the given
#                   rule during a year. It returns:
#                     (date dst_offset timetype lett ...)
#                   where dst_offset is the daylight saving time offset
#                   that starts at that date and timetype is 'u', 'w', or
#                   's', and lett is the letter to use in the abbrev.
#
sub _ruleInfo {
   my($self,$rule,$info,@args) = @_;
   my $year                    = shift(@args);

   if (exists $$self{'ruleinfo'}{$info}  &&
       exists $$self{'ruleinfo'}{$info}{$rule}  &&
       exists $$self{'ruleinfo'}{$info}{$rule}{$year}) {
      if (ref $$self{'ruleinfo'}{$info}{$rule}{$year}) {
         return @{ $$self{'ruleinfo'}{$info}{$rule}{$year} };
      } else {
         return $$self{'ruleinfo'}{$info}{$rule}{$year};
      }
   }

   if ($info eq 'rules') {
      my @ret;
      foreach my $r ($self->_tzd_Rule($rule)) {
         my($y0,$y1,$ytype,$mon,$flag,$dow,$num,$timetype,$time,$offset,
            $lett) = @$r;
         next  if ($y0>$year  ||  $y1<$year);
         push(@ret,$r)  if ($ytype eq "-"  ||
                            $year == 9999    ||
                            ($ytype eq 'even'  &&  $year =~ /[02468]$/)  ||
                            ($ytype eq 'odd'   &&  $year =~ /[13579]$/));
      }

      # We'll sort them... if there are ever two time changes in a
      # single month, this will cause problems... hopefully there
      # never will be.

      @ret = sort { $$a[3] <=> $$b[3] } @ret;
      $$self{'ruleinfo'}{$info}{$rule}{$year} = [ @ret ];
      return @ret;

   } elsif ($info eq 'stdlett'  ||
            $info eq 'savlett') {
      my @rules = $self->_ruleInfo($rule,'rules',$year);
      my %lett  = ();
      foreach my $r (@rules) {
         my($y0,$y1,$ytype,$mon,$flag,$dow,$num,$timetype,$time,$offset,
            $lett) = @$r;
         $lett{$lett} = 1
           if ( ($info eq 'stdlett'  &&  $offset eq '00:00:00') ||
                ($info eq 'savlett'  &&  $offset ne '00:00:00') );
      }

      my $ret;
      if (! %lett) {
         $ret = '';
      } else {
         $ret = join(",",sort keys %lett);
      }
      $$self{'ruleinfo'}{$info}{$rule}{$year} = $ret;
      return $ret;

   } elsif ($info eq 'lastoff') {
      my $ret;
      my @rules = $self->_ruleInfo($rule,'rules',$year);
      return '00:00:00'  if (! @rules);
      my $r     = pop(@rules);
      my($y0,$y1,$ytype,$mon,$flag,$dow,$num,$timetype,$time,$offset,
         $lett) = @$r;

      $$self{'ruleinfo'}{$info}{$rule}{$year} = $offset;
      return $offset;

   } elsif ($info eq 'rdates') {
      my @ret;
      my @rules = $self->_ruleInfo($rule,'rules',$year);
      foreach my $r (@rules) {
         my($y0,$y1,$ytype,$mon,$flag,$dow,$num,$timetype,$time,$offset,
            $lett) = @$r;
         my($date) = $self->_tzd_ParseRuleDate($year,$mon,$dow,$num,$flag,$time);
         push(@ret,$date,$offset,$timetype,$lett);
      }

      $$self{'ruleinfo'}{$info}{$rule}{$year} = [ @ret ];
      return @ret;
   }
}

###############################################################################
# ZONEINFO
###############################################################################

# zonelines is:
#    ( ZONE => numlines => N,
#              I        => { start  => DATE,
#                            end    => DATE,
#                            stdoff => OFFSET,
#                            dstbeg => OFFSET,
#                            dstend => OFFSET,
#                            letbeg => LETTER,
#                            letend => LETTER,
#                            abbrev => ABBREV,
#                            rule   => RULE
#                          }
#    )
# where I = 1..N
#       start, end   the wallclock start/end time of this period
#       stdoff       the standard GMT offset during this period
#       dstbeg       the DST offset at the start of this period
#       dstend       the DST offset at the end of this period
#       letbeg       the letter (if any) used at the start of this period
#       letend       the letter (if any) used at the end of this period
#       abbrev       the zone abbreviation during this period
#       rule         the rule that applies (if any) during this period

# @info = $tzd->zoneinfo($zone,@args);
#
# Obtain information from a zone
#
#    @args
#    ------------
#
#    zonelines Y  : Return the full zone line(s) which apply for
#                   a given year.
#    rules YEAR   : Returns a list of rule names and types which
#                   apply for the given year.
#
sub _zoneInfo {
   my($self,$zone,$info,@args) = @_;

   if (! exists $$self{'zonelines'}{$zone}) {
      $self->_tzd_ZoneLines($zone);
   }

   my @z = $self->_tzd_Zone($zone);
   shift(@z);                # Get rid of timezone name

   my $ret;

#    if      ($info eq 'numzonelines') {
#       return $$self{'zonelines'}{$zone}{'numlines'};

#    } elsif ($info eq 'zoneline') {
#       my ($i) = @args;
#       my @ret = map { $$self{'zonelines'}{$zone}{$i}{$_} }
#         qw(start end stdoff dstbeg dstend letbeg letend abbrev rule);

#       return @ret;
#    }

   my $y = shift(@args);
   if (exists $$self{'zoneinfo'}{$info}  &&
       exists $$self{'zoneinfo'}{$info}{$zone}  &&
       exists $$self{'zoneinfo'}{$info}{$zone}{$y}) {
      if (ref($$self{'zoneinfo'}{$info}{$zone}{$y})) {
         return @{ $$self{'zoneinfo'}{$info}{$zone}{$y} };
      } else {
         return $$self{'zoneinfo'}{$info}{$zone}{$y};
      }
   }

   if      ($info eq 'zonelines') {
      my (@ret);
      while (@z) {
         # y = 1920
         #    until = 1919          NO
         #    until = 1920          NO
         #    until = 1920 Feb...   YES
         #    until = 1921...       YES, last
         my $z = shift(@z);
         my($offset,$ruletype,$rule,$abbrev,$yr,$mon,$dow,$num,$flag,$time,
            $timetype,$start,$end) = @$z;
         next  if ($yr < $y);
         next  if ($yr == $y  &&  $flag == $TZ_DOM  &&
                   $mon == 1  &&  $num == 1  &&  $time eq '00:00:00');
         push(@ret,$z);
         last  if ($yr > $y);
      }

      $$self{'zoneinfo'}{$info}{$zone}{$y} = [ @ret ];
      return @ret;

   } elsif ($info eq 'rules') {
      my (@ret);
      @z = $self->_zoneInfo($zone,'zonelines',$y);
      foreach my $z (@z) {
         my($offset,$ruletype,$rule,$abbrev,$yr,$mon,$dow,$num,$flag,$time,
            $timetype,$start,$end) = @$z;
         push(@ret,$rule,$ruletype);
      }

      $$self{'zoneinfo'}{$info}{$zone}{$y} = [ @ret ];
      return @ret;
   }
}

########################################################################
# PARSING TZDATA FILES
########################################################################

# These routine parses the raw tzdata file.  Files contain three types
# of lines:
#
#   Link CANONICAL ALIAS
#   Rule NAME FROM TO TYPE IN ON AT SAVE LETTERS
#   Zone NAME GMTOFF RULE FORMAT UNTIL
#             GMTOFF RULE FORMAT UNTIL
#             ...
#             GMTOFF RULE FORMAT

# Parse all files
sub _tzd_ParseFiles {
   my($self) = @_;

   print "PARSING FILES...\n"  if ($Verbose);

   foreach my $file (@StdFiles) {
      $self->_tzd_ParseFile($file);
   }

   $self->_tzd_CheckData();
}

# Parse a file
sub _tzd_ParseFile {
   my($self,$file) = @_;
   my $in    = new IO::File;
   my $dir   = $$self{'dir'};
   print "... $file\n"  if ($Verbose);
   if (! $in->open("$dir/tzdata/$file")) {
      warn "WARNING: [parse_file] unable to open file: $file: $!\n";
      return;
   }
   my @in   = <$in>;
   $in->close;
   chomp(@in);

   # strip out comments
   foreach my $line (@in) {
      $line =~ s/^\s+//;
      $line =~ s/#.*$//;
      $line =~ s/\s+$//;
   }

   # parse all lines
   my $n    = 0;                # line number
   my $zone = '';     # current zone (if in a multi-line zone section)

   while (@in) {
      if (! $in[0]) {
         $n++;
         shift(@in);

      } elsif ($in[0] =~ /^Zone/) {
         $self->_tzd_ParseZone($file,\$n,\@in);

      } elsif ($in[0] =~ /^Link/) {
         $self->_tzd_ParseLink($file,\$n,\@in);

      } elsif ($in[0] =~ /^Rule/) {
         $self->_tzd_ParseRule($file,\$n,\@in);

      } else {
         $n++;
         my $line = shift(@in);
         warn "WARNING: [parse_file] unknown line: $n\n" .
              "         $line\n";
      }
   }
}

sub _tzd_ParseLink {
   my($self,$file,$n,$lines) = @_;

   $$n++;
   my $line = shift(@$lines);

   my(@tmp) = split(/\s+/,$line);
   if ($#tmp != 2  ||  lc($tmp[0]) ne 'link') {
      warn "ERROR: [parse_file] invalid Link line: $file: $$n\n" .
           "       $line\n";
      return;
   }

   my($tmp,$zone,$alias) = @tmp;

   if ($self->_tzd_Alias($alias)) {
      warn "WARNING: [parse_file] alias redefined: $file: $$n: $alias\n";
   }

   $self->_tzd_Alias($alias,$zone);
}

sub _tzd_ParseRule {
   my($self,$file,$n,$lines) = @_;

   $$n++;
   my $line = shift(@$lines);

   my(@tmp) = split(/\s+/,$line);
   if ($#tmp != 9  ||  lc($tmp[0]) ne 'rule') {
      warn "ERROR: [parse_file] invalid Rule line: $file: $$n:\n" .
           "       $line\n";
      return;
   }

   my($tmp,$name,$from,$to,$type,$in,$on,$at,$save,$letters) = @tmp;

   $self->_tzd_Rule($name,[ $from,$to,$type,$in,$on,$at,$save,$letters ]);
}

sub _tzd_ParseZone {
   my($self,$file,$n,$lines) = @_;

   # Remove "Zone America/New_York" from the first line

   $$n++;
   my $line = shift(@$lines);
   my @tmp  = split(/\s+/,$line);

   if ($#tmp < 4  ||  lc($tmp[0]) ne 'zone') {
      warn "ERROR: [parse_file] invalid Zone line: $file :$$n\n" .
           "       $line\n";
      return;
   }

   shift(@tmp);
   my $zone = shift(@tmp);

   $line    = join(' ',@tmp);
   unshift(@$lines,$line);

   # Store the zone name information

   if ($self->_tzd_Zone($zone)) {
      warn "ERROR: [parse_file] zone redefined: $file: $$n: $zone\n";
      $self->_tzd_DeleteZone($zone);
   }
   $self->_tzd_Alias($zone,$zone);

   # Parse all zone lines

   while (1) {
      last  if (! @$lines);

      $line = $$lines[0];
      return  if ($line =~ /^(zone|link|rule)/i);

      $$n++;
      shift(@$lines);
      next  if (! $line);

      @tmp = split(/\s+/,$line);

      if ($#tmp < 2) {
         warn "ERROR: [parse_file] invalid Zone line: $file: $$n\n" .
              "       $line\n";
         return;
      }

      my($gmt,$rule,$format,@until) = @tmp;
      $self->_tzd_Zone($zone,[ $gmt,$rule,$format,@until ]);
   }
}

sub _tzd_CheckData {
   my($self) = @_;
   print "CHECKING DATA...\n"  if ($Verbose);
   $self->_tzd_CheckRules();
   $self->_tzd_CheckZones();
   $self->_tzd_CheckAliases();
}

########################################################################
# LINKS (ALIASES)
########################################################################

sub _tzd_Alias {
   my($self,$alias,$zone) = @_;

   if (defined $zone) {
      $$self{'alias'}{$alias} = $zone;
      return;

   } elsif (exists $$self{'alias'}{$alias}) {
      return $$self{'alias'}{$alias};

   } else {
      return '';
   }
}

sub _tzd_DeleteAlias {
   my($self,$alias) = @_;
   delete $$self{'alias'}{$alias};
}

sub _tzd_AliasKeys {
   my($self) = @_;
   return keys %{ $$self{'alias'} };
}

# TZdata file:
#
#   Link America/Denver America/Shiprock
#
# Stored locally as:
#
#  (
#     "us/eastern"             => "America/New_York"
#     "america/new_york"       => "America/New_York"
#  )

sub _tzd_CheckAliases {
   my($self) = @_;

   # Replace
   #   ALIAS1 -> ALIAS2 -> ... -> ZONE
   # with
   #   ALIAS1 -> ZONE

   print "... aliases\n"  if ($Verbose);

   ALIAS:
   foreach my $alias ($self->_tzd_AliasKeys()) {
      my $zone = $self->_tzd_Alias($alias);

      my %tmp;
      $tmp{$alias} = 1;
      while (1) {

         if      ($self->_tzd_Zone($zone)) {
            $self->_tzd_Alias($alias,$zone);
            next ALIAS;

         } elsif (exists $tmp{$zone}) {
            warn "ERROR: [check_aliases] circular alias definition: $alias\n";
            $self->_tzd_DeleteAlias($alias);
            next ALIAS;

         } elsif ($self->_tzd_Alias($zone)) {
            $tmp{$zone} = 1;
            $zone = $self->_tzd_Alias($zone);
            next;
         }

         warn "ERROR: [check_aliases] unresolved alias definition: $alias\n";
         $self->_tzd_DeleteAlias($alias);
         next ALIAS;
      }
   }
}

########################################################################
# PARSING RULES
########################################################################

sub _tzd_Rule {
   my($self,$rule,$listref) = @_;

   if (defined $listref) {
      if (! exists $$self{'rule'}{$rule}) {
         $$self{'rule'}{$rule} = [];
      }
      push @{ $$self{'rule'}{$rule} }, [ @$listref ];

   } elsif (exists $$self{'rule'}{$rule}) {
      return @{ $$self{'rule'}{$rule} };

   } else {
      return ();
   }
}

sub _tzd_DeleteRule {
   my($self,$rule) = @_;
   delete $$self{'rule'}{$rule};
}

sub _tzd_RuleNames {
   my($self) = @_;
   return keys %{ $$self{'rule'} };
}

sub _tzd_CheckRules {
   my($self) = @_;
   print "... rules\n"  if ($Verbose);
   foreach my $rule ($self->_tzd_RuleNames()) {
      $Error   = 0;
      my @rule = $self->_tzd_Rule($rule);
      $self->_tzd_DeleteRule($rule);
      while (@rule) {
         my($from,$to,$type,$in,$on,$at,$save,$letters) =
           @{ shift(@rule) };
         my($dow,$num,$attype);
         $from             = $self->_rule_From   ($rule,$from);
         $to               = $self->_rule_To     ($rule,$to,$from);
         $type             = $self->_rule_Type   ($rule,$type);
         $in               = $self->_rule_In     ($rule,$in);
         ($on,$dow,$num)   = $self->_rule_On     ($rule,$on);
         ($attype,$at)     = $self->_rule_At     ($rule,$at);
         $save             = $self->_rule_Save   ($rule,$save);
         $letters          = $self->_rule_Letters($rule,$letters);

         if (! $Error) {
            $self->_tzd_Rule($rule,[ $from,$to,$type,$in,$on,$dow,$num,$attype,
                                    $at,$save,$letters ]);
         }
      }
      $self->_tzd_DeleteRule($rule)  if ($Error);
   }
}

# TZdata file:
#
#   #Rule NAME    FROM  TO    TYPE  IN   ON      AT      SAVE    LETTER
#   Rule  NYC     1920  only  -     Mar  lastSun 2:00    1:00    D
#   Rule  NYC     1920  only  -     Oct  lastSun 2:00    0       S
#   Rule  NYC     1921  1966  -     Apr  lastSun 2:00    1:00    D
#   Rule  NYC     1921  1954  -     Sep  lastSun 2:00    0       S
#   Rule  NYC     1955  1966  -     Oct  lastSun 2:00    0       S
#
# Stored locally as:
#
#  %Rule = (
#    'NYC' =>
#         [
#           [ 1920 1920 -  3 2 7  0 w 02:00:00 01:00:00 D ],
#           [ 1920 1920 - 10 2 7  0 w 02:00:00 00:00:00 S ],
#           [ 1921 1966 -  4 2 7  0 w 02:00:00 01:00:00 D ],
#           [ 1921 1954 -  9 2 7  0 w 02:00:00 00:00:00 S ],
#           [ 1955 1966 - 10 2 7  0 w 02:00:00 00:00:00 S ],
#         ],
#    'US' =>
#         [
#           [ 1918 1919 -  3 2 7  0 w 02:00:00 01:00:00 W ],
#           [ 1918 1919 - 10 2 7  0 w 02:00:00 00:00:00 S ],
#           [ 1942 1942 -  2 1 0  9 w 02:00:00 01:00:00 W ],
#           [ 1945 1945 -  9 1 0 30 w 02:00:00 00:00:00 S ],
#           [ 1967 9999 - 10 2 7  0 u 02:00:00 00:00:00 S ],
#           [ 1967 1973 -  4 2 7  0 w 02:00:00 01:00:00 D ],
#           [ 1974 1974 -  1 1 0  6 w 02:00:00 01:00:00 D ],
#           [ 1975 1975 -  2 1 0 23 w 02:00:00 01:00:00 D ],
#           [ 1976 1986 -  4 2 7  0 w 02:00:00 01:00:00 D ],
#           [ 1987 9999 -  4 3 7  1 u 02:00:00 01:00:00 D ],
#         ]
#  )
#
# Each %Rule list consists of:
#    Y0 Y1 YTYPE MON FLAG DOW NUM TIMETYPE TIME OFFSET LETTER
# where
#    Y0, Y1    : the year range for which this rule line might apply
#    YTYPE     : type of year where the rule does apply
#                even  : only applies to even numbered years
#                odd   : only applies to odd numbered years
#                -     : applies to all years in the range
#    MON       : the month where a change occurs
#    FLAG/DOW/NUM : specifies the day a time change occurs (interpreted
#                the same way the as in the zone description below)
#    TIMETYPE  : the type of time that TIME is
#                w     : wallclock time
#                u     : univeral time
#                s     : standard time
#    TIME      : HH:MM:SS where the time change occurs
#    OFFSET    : the offset (which is added to standard time offset)
#                starting at that time
#    LETTER    : letters that are substituted for %s in abbreviations

# Parses a day-of-month which can be given as a # (1-31), lastSun, or
# Sun>=13 or Sun<=24 format.
sub _rule_DOM {
   my($self,$dom) = @_;

   my %days = qw(mon 1 tue 2 wed 3 thu 4 fri 5 sat 6 sun 7);

   my($dow,$num,$flag,$err) = (0,0,0,0);
   my($i);

   if ($dom =~ /^(\d\d?)$/) {
      ($dow,$num,$flag)=(0,$1,$TZ_DOM);

   } elsif ($dom =~ /^last(.+)$/) {
      ($dow,$num,$flag)=($1,0,$TZ_LAST);

   } elsif ($dom =~ /^(.+)>=(\d\d?)$/) {
      ($dow,$num,$flag)=($1,$2,$TZ_GE);

   } elsif ($dom =~ /^(.+)<=(\d\d?)$/) {
      ($dow,$num,$flag)=($1,$2,$TZ_LE);

   } else {
      $err = 1;
   }

   if ($dow) {
      if (exists $days{ lc($dow) }) {
         $dow = $days{ lc($dow) };
      } else {
         $err = 1;
      }
   }

   $err = 1  if ($num>31);
   return ($dow,$num,$flag,$err);
}

# Parses a month from a string
sub _rule_Month {
   my($self,$mmm) = @_;

   my %months = qw(jan 1 feb 2 mar 3 apr 4 may 5 jun 6
                   jul 7 aug 8 sep 9 oct 10 nov 11 dec 12);

   if (exists $months{ lc($mmm) }) {
      return $months{ lc($mmm) };
   } else {
      return 0;
   }
}

# Returns a time. The time (HH:MM:SS) which may optionally be signed (if $sign
# is 1), and may optionally (if $type is 1) be followed by a type
# ('w', 'u', or 's').
sub _rule_Time {
   my($self,$time,$sign,$type) = @_;
   my($s,$t);

   if ($type) {
      $t = 'w';
      if ($type  &&  $time =~ s/(w|u|s)$//i) {
         $t = lc($1);
      }
   }

   if ($sign) {
      if ($time =~ s/^-//) {
         $s = "-";
      } else {
         $s = '';
         $time =~ s/^\+//;
      }
   } else {
      $s = '';
   }

   return ''  if ($time !~ /^(\d\d?)(?::(\d\d))?(?::(\d\d))?$/);
   my($hr,$mn,$se)=($1,$2,$3);
   $hr   = '00'    if (! $hr);
   $mn   = '00'    if (! $mn);
   $se   = '00'    if (! $se);
   $hr   = "0$hr"  if (length($hr)<2);
   $mn   = "0$mn"  if (length($mn)<2);
   $se   = "0$se"  if (length($se)<2);
   $time = "$s$hr:$mn:$se";
   if ($type) {
      return ($time,$t);
   } else {
      return $time;
   }
}

# a year or 'minimum'
sub _rule_From {
   my($self,$rule,$from) = @_;
   $from = lc($from);
   if ($from =~ /^\d\d\d\d$/) {
      return $from;
   } elsif ($from eq 'minimum'  ||  $from eq 'min') {
      return '0001';
   }
   warn "ERROR: [rule_from] invalid: $rule: $from\n";
   $Error = 1;
   return '';
}

# a year, 'maximum', or 'only'
sub _rule_To {
   my($self,$rule,$to,$from) = @_;
   $to = lc($to);
   if ($to =~ /^\d\d\d\d$/) {
      return $to;
   } elsif ($to eq 'maximum'  ||  $to eq 'max') {
      return '9999';
   } elsif (lc($to) eq 'only') {
      return $from;
   }
   warn "ERROR: [rule_to] invalid: $rule: $to\n";
   $Error = 1;
   return '';
}

# "-", 'even', or 'odd'
sub _rule_Type {
   my($self,$rule,$type) = @_;
   return lc($type)  if (lc($type) eq "-"     ||
                         lc($type) eq 'even'  ||
                         lc($type) eq 'odd');
   warn "ERROR: [rule_type] invalid: $rule: $type\n";
   $Error = 1;
   return '';
}

# a month
sub _rule_In {
   my($self,$rule,$in) = @_;
   my($i) = $self->_rule_Month($in);
   if (! $i) {
      warn "ERROR: [rule_in] invalid: $rule: $in\n";
      $Error = 1;
   }
   return $i;
}

# DoM (1-31), lastDow (lastSun), DoW<=number (Mon<=12),
# DoW>=number (Sat>=14)
#
# Returns: (flag,dow,num)
sub _rule_On {
   my($self,$rule,$on) = @_;
   my($dow,$num,$flag,$err) = $self->_rule_DOM($on);

   if ($err) {
      warn "ERROR: [rule_on] invalid: $rule: $on\n";
      $Error = 1;
   }

   return ($flag,$dow,$num);
}

# a time followed by 'w' (default), 'u', or 's';
sub _rule_At {
   my($self,$rule,$at) = @_;
   my($ret,$attype) = $self->_rule_Time($at,0,1);
   if (! $ret) {
      warn "ERROR: [rule_at] invalid: $rule: $at\n";
      $Error = 1;
   }
   return($attype,$ret);
}

# a signed time (or "-" which is equivalent to 0)
sub _rule_Save {
   my($self,$rule,$save) = @_;
   $save = '00:00:00'  if ($save eq "-");
   my($ret) = $self->_rule_Time($save,1);
   if (! $ret) {
      warn "ERROR: [rule_save] invalid: $rule: $save\n";
      $Error=1;
   }
   return $ret;
}

# letters (or "-")
sub _rule_Letters {
   my($self,$rule,$letters)=@_;
   return ''  if ($letters eq "-");
   return $letters;
}

########################################################################
# PARSING ZONES
########################################################################

my($TZ_START)    = $dmb->join('date',['0001',1,2,0,0,0]);
my($TZ_END)      = $dmb->join('date',['9999',12,30,23,59,59]);

sub _tzd_Zone {
   my($self,$zone,$listref) = @_;

   if (defined $listref) {
      if (! exists $$self{'zone'}{$zone}) {
         $$self{'zone'}{$zone} = [$zone];
      }
      push @{ $$self{'zone'}{$zone} }, [ @$listref ];

   } elsif (exists $$self{'zone'}{$zone}) {
      return @{ $$self{'zone'}{$zone} };

   } else {
      return ();
   }
}

sub _tzd_DeleteZone {
   my($self,$zone) = @_;
   delete $$self{'zone'}{$zone};
}

sub _tzd_ZoneKeys {
   my($self) = @_;
   return keys %{ $$self{'zone'} };
}

sub _tzd_CheckZones {
   my($self) = @_;
   print "... zones\n"  if ($Verbose);
   foreach my $zone ($self->_tzd_ZoneKeys()) {
      my($start) = $TZ_START;
      $Error = 0;
      my ($name,@zone) = $self->_tzd_Zone($zone);
      $self->_tzd_DeleteZone($zone);
      while (@zone) {
         my($gmt,$rule,$format,@until) = @{ shift(@zone) };
         my($ruletype);
         $gmt                = $self->_zone_GMTOff($zone,$gmt);
         ($ruletype,$rule)   = $self->_zone_Rule  ($zone,$rule);
         $format             = $self->_zone_Format($zone,$format);
         my($y,$m,$dow,$num,$flag,$t,$type,$end,$nextstart)
                             = $self->_zone_Until ($zone,@until);

         if (! $Error) {
            $self->_tzd_Zone($zone,[ $gmt,$ruletype,$rule,$format,$y,$m,$dow,
                                     $num,$flag,$t,$type,$start,$end ]);
            $start = $nextstart;
         }
      }
      $self->_tzd_DeleteZone($zone)  if ($Error);
   }
}

# TZdata file:
#
#   #Zone NAME               GMTOFF     RULES  FORMAT  [UNTIL]
#   Zone  America/New_York   -4:56:02   -      LMT     1883 Nov 18 12:03:58
#                            -5:00      US     E%sT    1920
#                            -5:00      NYC    E%sT    1942
#                            -5:00      US     E%sT    1946
#                            -5:00      NYC    E%sT    1967
#                            -5:00      US     E%sT
#
# Stored locally as:
#
#  %Zone = (
#    "America/New_York" =>
#         [
#           "America/New_York",
#           [ -04:56:02 1   -  LMT 1883 11 0 18 1 12:03:58 w START END ]
#          ,[ -05:00:00 2  US E%sT 1920 01 0 01 1 00:00:00 w START END ]
#          ,[ -05:00:00 2 NYC E%sT 1942 01 0 01 1 00:00:00 w START END ]
#          ,[ -05:00:00 2  US E%sT 1946 01 0 01 1 00:00:00 w START END ]
#          ,[ -05:00:00 2 NYC E%sT 1967 01 0 01 1 00:00:00 w START END ]
#          ,[ -05:00:00 2  US E%sT 9999 12 0 31 1 00:00:00 u START END ]
#         ]
#  )
#
# Each %Zone list consists of:
#    GMTOFF RULETYPE RULE ABBREV YEAR MON DOW NUM FLAG TIME TIMETYPE START
# where
#    GMTOFF    : the standard time offset for the time period starting
#                at the end of the previous peried, and ending at the
#                time specified by TIME/TIMETYPE
#    RULETYPE  : what type of value RULE can have
#                  $TZ_STANDARD     the entire period is standard time
#                  $TZ_RULE         the name of a rule to use for this period
#                  $TZ_OFFSET       an additional offset to apply for the
#                                   entire period (which is in saving time)
#    RULE      : a dash (-), the name of the rule, or an offset
#    ABBREV    : an abbreviation for the timezone (which may include a %s
#                where letters from a rule are substituted)
#    YEAR/MON  : the year and month where the time period ends
#    DOW/NUM/FLAG : the day of the month where the time period ends (see
#                note below)
#    TIME      : HH:MM:SS where the time period ends
#    TIMETYPE  : how the time is to be interpreted
#                  u    in UTC
#                  w    wallclock time
#                  s    in standard time
#    START     : This is the wallclock time when this zoneline starts. If the
#                wallclock time cannot be decided yet, it is left blank. In
#                the case of a non-wallclock time, the change should NOT
#                occur on Dec 31 or Jan 1.
#    END       : The wallclock date/time when the zoneline ends. Blank if
#                it cannot be decided.
#
# The time stored in the until fields (which is turned into the
# YEAR/MON/DOW/NUM/FLAG fields) actually refers to the exact second when
# the following zone line takes affect. When a rule specifies a time
# change exactly at that time (unfortunately, this situation DOES occur),
# the change will only apply to the next zone line.
#
# In interpreting DOW, NUM, FLAG, the value of FLAG determines how it is
# done.  Values are:
#    $TZ_DOM   NUM is the day of month (1-31), DOW is ignored
#    $TZ_LAST  NUM is ignored, DOW is the day of week (1-7); the day
#              of month is the last DOW in the month
#    $TZ_GE    NUM is a cutoff date (1-31), DOW is the day of week; the
#              day of month is the first DOW in the month on or after
#              the cutoff date
#    $TZ_LE    Similar to $TZ_GE but the day of month is the last DOW in
#              the month on or before the cutoff date
#
# In a time period which uses a named rule, if the named rule doesn't
# cover a year, just use the standard time for that year.

# The total period covered by zones is from Jan 2, 0001 (00:00:00) to
# Dec 30, 9999 (23:59:59). The first and last days are ignored so that
# they can safely be expressed as wallclock time.

# a signed time
sub _zone_GMTOff {
   my($self,$zone,$gmt) = @_;
   my($ret) = $self->_rule_Time($gmt,1);
   if (! $ret) {
      warn "ERROR: [zone_gmtoff] invalid: $zone: $gmt\n";
      $Error = 1;
   }
   return $ret;
}

# rule, a signed time, or "-"
sub _zone_Rule {
   my($self,$zone,$rule) = @_;
   return ($TZ_STANDARD,$rule)  if ($rule eq "-");
   my($ret) = $self->_rule_Time($rule,1);
   return ($TZ_OFFSET,$ret)     if ($ret);
   if (! $self->_tzd_Rule($rule)) {
      warn "ERROR: [zone_rule] rule undefined: $zone: $rule\n";
      $Error = 1;
   }
   return ($TZ_RULE,$rule);
}

# a format
sub _zone_Format {
   my($self,$zone,$format)=@_;
   return $format;
}

# a date (YYYY MMM DD TIME)
sub _zone_Until {
   my($self,$zone,$y,$m,$d,$t) = @_;
   my($tmp,$type,$dow,$num,$flag,$err);

   if (! $y) {
      # Until '' == Until '9999 Dec 31 00:00:00'
      $y = 9999;
      $m = 12;
      $d = 31;
      $t = '00:00:00';

   } else {
      # Until '1975 ...'
      if ($y !~ /^\d\d\d\d$/) {
         warn "ERROR: [zone_until] invalid year: $zone: $y\n";
         $Error = 1;
         return ();
      }

      if (! $m) {
         # Until '1920' == Until '1920 Jan 1 00:00:00'
         $m = 1;
         $d = 1;
         $t = '00:00:00';

      } else {

         # Until '1920 Mar ...'
         $tmp = $self->_rule_Month($m);
         if (! $tmp) {
            warn "ERROR: [zone_until] invalid month: $zone: $m\n";
            $Error = 1;
            return ();
         }
         $m = $tmp;

         if (! $d) {
            # Until '1920 Feb' == Until '1920 Feb 1 00:00:00'
            $d = 1;
            $t = '00:00:00';

         } elsif ($d =~ /^last(.*)/) {
            # Until '1920 Feb lastSun ...'
            my(@tmp) = $self->_rule_DOM($d);
            my($dow) = $tmp[0];
            my $ymd  = $dmb->nth_day_of_week($y,-1,$dow,$m);
            $d       = $$ymd[2];

         } elsif ($d =~ />=/) {
            my(@tmp) = $self->_rule_DOM($d);
            my $dow  = $tmp[0];
            $d       = $tmp[1];
            my $ddow = $dmb->day_of_week([$y,$m,$d]);
            if ($dow > $ddow) {
               my $ymd = $dmb->calc_date_days([$y,$m,$d],$dow-$ddow);
               $d      = $$ymd[2];
            } elsif ($dow < $ddow) {
               my $ymd = $dmb->calc_date_days([$y,$m,$d],7-($ddow-$dow));
               $d      = $$ymd[2];
            }

         } elsif ($d =~ /<=/) {
            my(@tmp) = $self->_rule_DOM($d);
            my $dow  = $tmp[0];
            $d       = $tmp[1];
            my $ddow = $dmb->day_of_week([$y,$m,$d]);
            if ($dow < $ddow) {
               my $ymd = $dmb->calc_date_days([$y,$m,$d],$ddow-$dow,1);
               $d      = $$ymd[2];
            } elsif ($dow > $ddow) {
               my $ymd = $dmb->calc_date_days([$y,$m,$d],7-($dow-$ddow),1);
               $d      = $$ymd[2];
            }

         } else {
            # Until '1920 Feb 20 ...'
         }

         if (! $t) {
            # Until '1920 Feb 20' == Until '1920 Feb 20 00:00:00'
            $t = '00:00:00';
         }
      }
   }

   # Make sure that day and month are valid and formatted correctly
   ($dow,$num,$flag,$err) = $self->_rule_DOM($d);
   if ($err) {
      warn "ERROR: [zone_until] invalid day: $zone: $d\n";
      $Error = 1;
      return ();
   }

   $m = "0$m"  if (length($m)<2);

   # Get the time type
   if ($y == 9999) {
      $type = 'w';
   } else {
      ($tmp,$type) = $self->_rule_Time($t,0,1);
      if (! $tmp) {
         warn "ERROR: [zone_until] invalid time: $zone: $t\n";
         $Error = 1;
         return ();
      }
      $t = $tmp;
   }

   # Get the wallclock end of this zone line (and the start of the
   # next one 1 second later) if possible. Since we cannot assume that
   # the rules are present yet, we can only do this for wallclock time
   # types. 'u' and 's' time types will be done later.
   my ($start,$end) = ('','');
   if ($type eq 'w') {
      # Start of next time is Y-M-D-TIME
      $start = $dmb->join('date',[$y,$m,$d,@{ $dmb->split('hms',$t) }]);
      # End of this time is Y-M-D-TIME minus 1 second
      $end   = $dmb->_calc_date_time_strings($start,'0:0:1',1);
   }
   return ($y,$m,$dow,$num,$flag,$t,$type,$end,$start);
}

###############################################################################
# ROUTINES FOR GETTING INFORMATION OUT OF RULES/ZONES
###############################################################################

sub _tzd_ZoneLines {
   my($self,$zone) = @_;
   my @z     = $self->_tzd_Zone($zone);
   shift(@z);

   # This will fill in any missing start/end values using the rules
   # (which are now all present).

   my $i = 0;
   my($lastend,$lastdstend) = ('','00:00:00');
   foreach my $z (@z) {
      my($offset,$ruletype,$rule,$abbrev,$yr,$mon,$dow,$num,$flag,$time,
         $timetype,$start,$end) = @$z;

      # Make sure that we have a start wallclock time. We ALWAYS have the
      # start time of the first zone line, and we will always have the
      # end time of the zoneline before (if this is not the first) since
      # we will determine it below.

      if (! $start) {
         $start = $dmb->_calc_date_time_strings($lastend,'0:0:1',0);
      }

      # If we haven't got a wallclock end, we can't get it yet... but
      # we can get an unadjusted end which we'll use for determining
      # what offsets apply from the rules.

      my $fixend = 0;
      if (! $end) {
         $end    = $self->_tzd_ParseRuleDate($yr,$mon,$dow,$num,$flag,$time);
         $fixend = 1;
      }

      # Now we need to get the DST offset at the start and end of
      # the period.

      my($dstbeg,$dstend,$letbeg,$letend);
      if ($ruletype == $TZ_RULE) {
         $dstbeg = $lastdstend;

         # Get the year from the end time for the zone line
         # Get the dates for this rule.
         # Find the latest one which is less than the end date.
         # That's the end DST offset.

         my %lett   = ();
         my $tmp    = $dmb->split('date',$end);
         my $y      = $$tmp[0];
         my(@rdate) = $self->_ruleInfo($rule,'rdates',$y);
         my $d      = $start;
         while (@rdate) {
            my($date,$off,$type,$lett,@tmp) = @rdate;
            $lett{$off} = $lett;
            @rdate  = @tmp;
            next  if ($date lt $d  ||  $date gt $end);
            $d      = $date;
            $dstend = $off;
         }

         # If we didn't find $dstend, it's because the zone line
         # ends before any rules can go into affect.  If that is
         # the case, we'll do one of two things:
         #
         # If the zone line starts this year, no time changes
         # occured, so we set $dstend to the same as $dstbeg.
         #
         # Otherwise, set it to the last DST offset of the year
         # before.

         if (! $dstend) {
            my($yrbeg) = $dmb->join('date',[$y,1,1,0,0,0]);
            if ($start ge $yrbeg) {
               $dstend = $dstbeg;
            } else {
               $dstend = $self->_ruleInfo($rule,'lastoff',$y);
            }
         }

         $letbeg = $lett{$dstbeg};
         $letend = $lett{$dstend};

      } elsif ($ruletype == $TZ_STANDARD) {
         $dstbeg = '00:00:00';
         $dstend = $dstbeg;
         $letbeg = '';
         $letend = '';
      } else {
         $dstbeg = $rule;
         $dstend = $dstbeg;
         $letbeg = '';
         $letend = '';
      }

      # Now we calculate the wallclock end time (if we don't already
      # have it).

      if ($fixend) {
         if ($timetype eq 'u') {
            # UT time -> STD time
            $end = $dmb->_calc_date_time_strings($end,$offset,0);
         }
         # STD time -> wallclock time
         $end = $dmb->_calc_date_time_strings($end,$dstend,1);
      }

      # Store the information

      $i++;
      $$self{'zonelines'}{$zone}{$i}{'start'}  = $start;
      $$self{'zonelines'}{$zone}{$i}{'end'}    = $end;
      $$self{'zonelines'}{$zone}{$i}{'stdoff'} = $offset;
      $$self{'zonelines'}{$zone}{$i}{'dstbeg'} = $dstbeg;
      $$self{'zonelines'}{$zone}{$i}{'dstend'} = $dstend;
      $$self{'zonelines'}{$zone}{$i}{'letbeg'} = $letbeg;
      $$self{'zonelines'}{$zone}{$i}{'letend'} = $letend;
      $$self{'zonelines'}{$zone}{$i}{'abbrev'} = $abbrev;
      $$self{'zonelines'}{$zone}{$i}{'rule'}   = ($ruletype == $TZ_RULE ?
                                         $rule : '');
      $lastend    = $end;
      $lastdstend = $dstend;
   }
   $$self{'zonelines'}{$zone}{'numlines'} = $i;
}

# Parses date information from  a single rule and returns a date.
# The date is not adjusted for standard time or daylight saving time
# offsets.
sub _tzd_ParseRuleDate {
   my($self,$year,$mon,$dow,$num,$flag,$time) = @_;

   # Calculate the day-of-month
   my($dom);
   if ($flag==$TZ_DOM) {
      $dom = $num;
   } elsif ($flag==$TZ_LAST) {
      ($year,$mon,$dom) = @{ $dmb->nth_day_of_week($year,-1,$dow,$mon) };
   } elsif ($flag==$TZ_GE) {
      ($year,$mon,$dom) = @{ $dmb->nth_day_of_week($year,1,$dow,$mon) };
      while ($dom<$num) {
         $dom += 7;
      }
   } elsif ($flag==$TZ_LE) {
      ($year,$mon,$dom) = @{ $dmb->nth_day_of_week($year,-1,$dow,$mon) };
      while ($dom>$num) {
         $dom -= 7;
      }
   }

   # Split the time and then form the date
   my($h,$mn,$s) = split(/:/,$time);

   return $dmb->join('date',[$year,$mon,$dom,$h,$mn,$s]);
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
