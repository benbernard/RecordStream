package Time::Timezone;

require 5.002;

require Exporter;
@ISA = qw(Exporter);
@EXPORT = qw(tz2zone tz_local_offset tz_offset tz_name);
@EXPORT_OK = qw();

use Carp;
use strict;

# Parts stolen from code by Paul Foley <paul@ascent.com>

use vars qw($VERSION);

$VERSION = 2006.0814;

sub tz2zone
{
	my($TZ, $time, $isdst) = @_;

	use vars qw(%tzn_cache);

	$TZ = defined($ENV{'TZ'}) ? ( $ENV{'TZ'} ? $ENV{'TZ'} : 'GMT' ) : ''
	    unless $TZ;

	# Hack to deal with 'PST8PDT' format of TZ
	# Note that this can't deal with all the esoteric forms, but it
	# does recognize the most common: [:]STDoff[DST[off][,rule]]

	if (! defined $isdst) {
		my $j;
		$time = time() unless $time;
		($j, $j, $j, $j, $j, $j, $j, $j, $isdst) = localtime($time);
	}

	if (defined $tzn_cache{$TZ}->[$isdst]) {
		return $tzn_cache{$TZ}->[$isdst];
	}
      
	if ($TZ =~ /^
		    ( [^:\d+\-,] {3,} )
		    ( [+-] ?
		      \d {1,2}
		      ( : \d {1,2} ) {0,2} 
		    )
		    ( [^\d+\-,] {3,} )?
		    /x
	    ) {
		$TZ = $isdst ? $4 : $1;
		$tzn_cache{$TZ} = [ $1, $4 ];
	} else {
		$tzn_cache{$TZ} = [ $TZ, $TZ ];
	}
	return $TZ;
}

sub tz_local_offset
{
	my ($time) = @_;

	$time = time() unless $time;

    return &calc_off($time);
}

sub calc_off
{
	my ($time) = @_;

	my (@l) = localtime($time);
	my (@g) = gmtime($time);

	my $off;

	$off =	   $l[0] - $g[0]
		+ ($l[1] - $g[1]) * 60
		+ ($l[2] - $g[2]) * 3600;

	# subscript 7 is yday.

	if ($l[7] == $g[7]) {
		# done
	} elsif ($l[7] == $g[7] + 1) {
		$off += 86400;
	} elsif ($l[7] == $g[7] - 1) {
		$off -= 86400;
	} elsif ($l[7] < $g[7]) {
		# crossed over a year boundary!
		# localtime is beginning of year, gmt is end
		# therefore local is ahead
		$off += 86400;
	} else {
		$off -= 86400;
	}

	return $off;
}

# constants
# The rest of the file originally comes from Graham Barr <bodg@tiuk.ti.com> 
#
# Some references:
#  http://www.weltzeituhr.com/laender/zeitzonen_e.shtml
#  http://www.worldtimezone.com/wtz-names/timezonenames.html
#  http://www.timegenie.com/timezones.php

CONFIG: {
	use vars qw(%dstZone %zoneOff %dstZoneOff %Zone);

	%dstZone = (
	    "brst" =>	-2*3600,	 # Brazil Summer Time (East Daylight)
	    "adt"  =>	-3*3600,	 # Atlantic Daylight   
	    "edt"  =>	-4*3600,	 # Eastern Daylight
	    "cdt"  =>	-5*3600,	 # Central Daylight
	    "mdt"  =>	-6*3600,	 # Mountain Daylight
	    "pdt"  =>	-7*3600,	 # Pacific Daylight
	    "ydt"  =>	-8*3600,	 # Yukon Daylight
	    "hdt"  =>	-9*3600,	 # Hawaii Daylight
	    "bst"  =>	+1*3600,	 # British Summer   
	    "mest" =>	+2*3600,	 # Middle European Summer   
	    "met dst" => +2*3600,	 # Middle European Summer   
	    "sst"  =>	+2*3600,	 # Swedish Summer
	    "fst"  =>	+2*3600,	 # French Summer
	    "eest" =>	+3*3600,	 # Eastern European Summer
	    "cest" =>	+2*3600,	 # Central European Daylight
	    "wadt" =>	+8*3600,	 # West Australian Daylight
	    "kdt"  =>  +10*3600,	 # Korean Daylight
	#   "cadt" =>  +10*3600+1800,	 # Central Australian Daylight
	    "eadt" =>  +11*3600,	 # Eastern Australian Daylight
	    "nzdt" =>  +13*3600,	 # New Zealand Daylight	  
	);

	# not included due to ambiguity:
	#	IST     Indian Standard Time            +5.5
	#		Ireland Standard Time           0
	#		Israel Standard Time            +2
	#	IDT     Ireland Daylight Time           +1
	#		Israel Daylight Time            +3
	#	AMST    Amazon Standard Time /          -3
	#		Armenia Standard Time           +8
	#	BST	Brazil Standard			-3

	%Zone = (
	    "gmt"	=>   0,		 # Greenwich Mean
	    "ut"	=>   0,		 # Universal (Coordinated)
	    "utc"	=>   0,
	    "wet"	=>   0,		 # Western European
	    "wat"	=>  -1*3600,	 # West Africa
	    "azost"	=>  -1*3600,	 # Azores Standard Time
	    "cvt"	=>  -1*3600,	 # Cape Verde Time
	    "at"	=>  -2*3600,	 # Azores
	    "fnt"	=>  -2*3600,	 # Brazil Time (Extreme East - Fernando Noronha)
	    "ndt" 	=>  -2*3600-1800,# Newfoundland Daylight   
	    "art"	=>  -3*3600,	 # Argentina Time
	# For completeness.  BST is also British Summer, and GST is also Guam Standard.
	#   "gst"	=>  -3*3600,	 # Greenland Standard
	    "nft"	=>  -3*3600-1800,# Newfoundland
	#   "nst"	=>  -3*3600-1800,# Newfoundland Standard
	    "mnt"	=>  -4*3600,	 # Brazil Time (West Standard - Manaus)
	    "ewt"	=>  -4*3600,	 # U.S. Eastern War Time
	    "ast"	=>  -4*3600,	 # Atlantic Standard
	    "bot"	=>  -4*3600,	 # Bolivia Time
	    "vet"	=>  -4*3600,	 # Venezuela Time
	    "est"	=>  -5*3600,	 # Eastern Standard
	    "cot"	=>  -5*3600,	 # Colombia Time
	    "act"	=>  -5*3600,	 # Brazil Time (Extreme West - Acre)
	    "pet"	=>  -5*3600,	 # Peru Time
	    "cst"	=>  -6*3600,	 # Central Standard
	    "cest"	=>  +2*3600,	 # Central European Summer
	    "mst"	=>  -7*3600,	 # Mountain Standard
	    "pst"	=>  -8*3600,	 # Pacific Standard
	    "yst"	=>  -9*3600,	 # Yukon Standard
	    "hst"	=> -10*3600,	 # Hawaii Standard
	    "cat"	=> -10*3600,	 # Central Alaska
	    "ahst"	=> -10*3600,	 # Alaska-Hawaii Standard
	    "taht"	=> -10*3600,	 # Tahiti Time
	    "nt"	=> -11*3600,	 # Nome
	    "idlw"	=> -12*3600,	 # International Date Line West
	    "cet"	=>  +1*3600,	 # Central European
	    "mez"	=>  +1*3600,	 # Central European (German)
	    "met"	=>  +1*3600,	 # Middle European
	    "mewt"	=>  +1*3600,	 # Middle European Winter
	    "swt"	=>  +1*3600,	 # Swedish Winter
	    "set"	=>  +1*3600,	 # Seychelles
	    "fwt"	=>  +1*3600,	 # French Winter
	    "west"	=>  +1*3600,	 # Western Europe Summer Time
	    "eet"	=>  +2*3600,	 # Eastern Europe, USSR Zone 1
	    "ukr"	=>  +2*3600,	 # Ukraine
	    "sast"	=>  +2*3600,	 # South Africa Standard Time
	    "bt"	=>  +3*3600,	 # Baghdad, USSR Zone 2
	    "eat"	=>  +3*3600,	 # East Africa Time
	#   "it"	=>  +3*3600+1800,# Iran
	    "irst"	=>  +3*3600+1800,# Iran Standard Time
	    "zp4"	=>  +4*3600,	 # USSR Zone 3
	    "msd"	=>  +4*3600,	 # Moscow Daylight Time
	    "sct"	=>  +4*3600,	 # Seychelles Time
	    "zp5"	=>  +5*3600,	 # USSR Zone 4
	    "azst"	=>  +5*3600,	 # Azerbaijan Summer Time
	    "mvt"	=>  +5*3600,	 # Maldives Time
	    "uzt"	=>  +5*3600,	 # Uzbekistan Time
	    "ist"	=>  +5*3600+1800,# Indian Standard
	    "zp6"	=>  +6*3600,	 # USSR Zone 5
	    "lkt"	=>  +6*3600,	 # Sri Lanka Time
	    "pkst"	=>  +6*3600,	 # Pakistan Summer Time
	    "yekst"	=>  +6*3600,	 # Yekaterinburg Summer Time
	# For completeness.  NST is also Newfoundland Stanard, and SST is also Swedish Summer.
	#   "nst"	=>  +6*3600+1800,# North Sumatra
	#   "sst"	=>  +7*3600,	 # South Sumatra, USSR Zone 6
	    "wast"	=>  +7*3600,	 # West Australian Standard
	    "ict"	=>  +7*3600,	 # Indochina Time
	    "wit"	=>  +7*3600,	 # Western Indonesia Time
	#   "jt"	=>  +7*3600+1800,# Java (3pm in Cronusland!)
	    "cct"	=>  +8*3600,	 # China Coast, USSR Zone 7
	    "wst"	=>  +8*3600,	 # West Australian Standard
	    "hkt"	=>  +8*3600,	 # Hong Kong
	    "bnt"	=>  +8*3600,	 # Brunei Darussalam Time
	    "cit"	=>  +8*3600,	 # Central Indonesia Time
	    "myt"	=>  +8*3600,	 # Malaysia Time
	    "pht"	=>  +8*3600,	 # Philippines Time
	    "sgt"	=>  +8*3600,	 # Singapore Time
	    "jst"	=>  +9*3600,	 # Japan Standard, USSR Zone 8
	    "kst"	=>  +9*3600,	 # Korean Standard
	#   "cast"	=>  +9*3600+1800,# Central Australian Standard
	    "east"	=> +10*3600,	 # Eastern Australian Standard
	    "gst"	=> +10*3600,	 # Guam Standard, USSR Zone 9
	    "nct"	=> +11*3600,	 # New Caledonia Time
	    "nzt"	=> +12*3600,	 # New Zealand
	    "nzst"	=> +12*3600,	 # New Zealand Standard
	    "fjt"	=> +12*3600,	 # Fiji Time
	    "idle"	=> +12*3600,	 # International Date Line East
	);

	%zoneOff = reverse(%Zone);
	%dstZoneOff = reverse(%dstZone);

	# Preferences

	$zoneOff{0}	  = 'gmt';
	$dstZoneOff{3600} = 'bst';

}

sub tz_offset
{
	my ($zone, $time) = @_;

	return &tz_local_offset() unless($zone);

	$time = time() unless $time;
	my(@l) = localtime($time);
	my $dst = $l[8];

	$zone = lc $zone;

	if ($zone =~ /^([\-\+]\d{3,4})$/) {
		my $sign = $1 < 0 ? -1 : 1 ;
		my $v = abs(0 + $1);
		return $sign * 60 * (int($v / 100) * 60 + ($v % 100));
	} elsif (exists $dstZone{$zone} && ($dst || !exists $Zone{$zone})) {
		return $dstZone{$zone};
	} elsif(exists $Zone{$zone}) {
		return $Zone{$zone};
	}
	undef;
}

sub tz_name
{
	my ($off, $time) = @_;

	$time = time() unless $time;
	my(@l) = localtime($time);
	my $dst = $l[8];

	if (exists $dstZoneOff{$off} && ($dst || !exists $zoneOff{$off})) {
		return $dstZoneOff{$off};
	} elsif (exists $zoneOff{$off}) {
		return $zoneOff{$off};
	}
	sprintf("%+05d", int($off / 60) * 100 + $off % 60);
}

1;

__END__

=head1 NAME

Time::Timezone -- miscellaneous timezone manipulations routines

=head1 SYNOPSIS

	use Time::Timezone;
	print tz2zone();
	print tz2zone($ENV{'TZ'});
	print tz2zone($ENV{'TZ'}, time());
	print tz2zone($ENV{'TZ'}, undef, $isdst);
	$offset = tz_local_offset();
	$offset = tz_offset($TZ);

=head1 DESCRIPTION

This is a collection of miscellaneous timezone manipulation routines.

C<tz2zone()> parses the TZ environment variable and returns a timezone
string suitable for inclusion in L<date>-like output.  It optionally takes
a timezone string, a time, and a is-dst flag.

C<tz_local_offset()> determines the offset from GMT time in seconds.  It
only does the calculation once.

C<tz_offset()> determines the offset from GMT in seconds of a specified
timezone.  

C<tz_name()> determines the name of the timezone based on its offset

=head1 AUTHORS

Graham Barr <bodg@tiuk.ti.com>
David Muir Sharnoff <muir@idiom.org>
Paul Foley <paul@ascent.com>

=head1 LICENSE

David Muir Sharnoff disclaims any copyright and puts his contribution
to this module in the public domain.

