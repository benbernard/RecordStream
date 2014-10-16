package Date::Manip::Lang::swedish;
# Copyright (c) 1996-2014 Sullivan Beck. All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

########################################################################
########################################################################

require 5.010000;

use strict;
use warnings;
use utf8;

our($VERSION);
$VERSION='6.47';

our($Language,@Encodings,$LangName,$YearAdded);
@Encodings = qw(utf-8 ISO-8859-15 perl);
$LangName  = "Swedish";
$YearAdded = 1996;

$Language = {
  ampm => [['FM'], ['EM']],
  at => ['kl', 'kl.', 'klockan'],
  day_abb => [
    ['Mån', 'Man'],
    ['Tis'],
    ['Ons'],
    ['Tor'],
    ['Fre'],
    ['Lör', 'Lor'],
    ['Sön', 'Son'],
  ],
  day_char => [['M'], ['Ti'], ['O'], ['To'], ['F'], ['L'], ['S']],
  day_name => [
    ['Måndag', 'Mandag'],
    ['Tisdag'],
    ['Onsdag'],
    ['Torsdag'],
    ['Fredag'],
    ['Lördag', 'Lordag'],
    ['Söndag', 'Sondag'],
  ],
  each => ['varje'],
  fields => [
    ['ar', 'år'],
    ['manader', 'månader', 'man', 'manad', 'mån', 'månad'],
    ['veckor', 'v', 'vecka'],
    ['dagar', 'd', 'dag'],
    ['timmar', 't', 'tim', 'timme'],
    ['minuter', 'm', 'min', 'minut'],
    ['sekunder', 's', 'sek', 'sekund'],
  ],
  last => ['forra', 'förra', 'senaste'],
  mode => [['exakt', 'ungefar', 'ungefär'], ['arbetsdag', 'arbetsdagar']],
  month_abb => [
    ['Jan'],
    ['Feb'],
    ['Mar'],
    ['Apr'],
    ['Maj'],
    ['Jun'],
    ['Jul'],
    ['Aug'],
    ['Sep'],
    ['Okt'],
    ['Nov'],
    ['Dec'],
  ],
  month_name => [
    ['Januari'],
    ['Februari'],
    ['Mars'],
    ['April'],
    ['Maj'],
    ['Juni'],
    ['Juli'],
    ['Augusti'],
    ['September'],
    ['Oktober'],
    ['November'],
    ['December'],
  ],
  nextprev => [['nasta', 'nästa'], ['forra', 'förra']],
  nth => [
    ['1:a', 'en', 'ett', 'forsta', 'första'],
    ['2:a', 'två', 'tva', 'andra'],
    ['3:e', 'tre', 'tredje'],
    ['4:e', 'fyra', 'fjarde', 'fjärde'],
    ['5:e', 'fem', 'femte'],
    ['6:e', 'sex', 'sjatte', 'sjätte'],
    ['7:e', 'sju', 'sjunde'],
    ['8:e', 'åtta', 'atta', 'attonde', 'åttonde'],
    ['9:e', 'nio', 'nionde'],
    ['10:e', 'tio', 'tionde'],
    ['11:e', 'elva', 'elfte'],
    ['12:e', 'tolv', 'tolfte'],
    ['13:e', 'tretton', 'trettonde'],
    ['14:e', 'fjorton', 'fjortonde'],
    ['15:e', 'femton', 'femtonde'],
    ['16:e', 'sexton', 'sextonde'],
    ['17:e', 'sjutton', 'sjuttonde'],
    ['18:e', 'arton', 'artonde'],
    ['19:e', 'nitton', 'nittonde'],
    ['20:e', 'tjugo', 'tjugonde'],
    ['21:a', 'tjugoen', 'tjugoett', 'tjugoforsta', 'tjugoförsta'],
    ['22:a', 'tjugotvå', 'tjugotva', 'tjugoandra'],
    ['23:e', 'tjugotre', 'tjugotredje'],
    ['24:e', 'tjugofyra', 'tjugofjarde', 'tjugofjärde'],
    ['25:e', 'tjugofem', 'tjugofemte'],
    ['26:e', 'tjugosex', 'tjugosjatte', 'tjugosjätte'],
    ['27:e', 'tjugosju', 'tjugosjunde'],
    ['28:e', 'tjugoåtta', 'tjugoatta', 'tjugoattonde', 'tjugoåttonde'],
    ['29:e', 'tjugonio', 'tjugonionde'],
    ['30:e', 'trettio', 'trettionde'],
    ['31:a', 'trettioen', 'trettioett', 'trettioforsta', 'trettioförsta'],
    ['32:a', 'trettiotvå', 'trettiotva', 'trettioandra'],
    ['33:e', 'trettiotre', 'trettiotredje'],
    ['34:e', 'trettiofyra', 'trettiofjarde', 'trettiofjärde'],
    ['35:e', 'trettiofem', 'trettiofemte'],
    ['36:e', 'trettiosex', 'trettiosjatte', 'trettiosjätte'],
    ['37:e', 'trettiosju', 'trettiosjunde'],
    ['38:e', 'trettioåtta', 'trettioatta', 'trettioattonde', 'trettioåttonde'],
    ['39:e', 'trettionio', 'trettionionde'],
    ['40:e', 'fyrtio', 'fyrtionde'],
    ['41:a', 'fyrtioen', 'fyrtioett', 'fyrtioforsta', 'fyrtioförsta'],
    ['42:a', 'fyrtiotvå', 'fyrtiotva', 'fyrtioandra'],
    ['43:e', 'fyrtiotre', 'fyrtiotredje'],
    ['44:e', 'fyrtiofyra', 'fyrtiofjarde', 'fyrtiofjärde'],
    ['45:e', 'fyrtiofem', 'fyrtiofemte'],
    ['46:e', 'fyrtiosex', 'fyrtiosjatte', 'fyrtiosjätte'],
    ['47:e', 'fyrtiosju', 'fyrtiosjunde'],
    ['48:e', 'fyrtioåtta', 'fyrtioatta', 'fyrtioattonde', 'fyrtioåttonde'],
    ['49:e', 'fyrtionio', 'fyrtionionde'],
    ['50:e', 'femtio', 'femtionde'],
    ['51:a', 'femtioen', 'femtioett', 'femtioforsta', 'femtioförsta'],
    ['52:a', 'femtiotvå', 'femtiotva', 'femtioandra'],
    ['53:e', 'femtiotre', 'femtiotredje'],
  ],
  of => ['om'],
  offset_date => {
    'idag'    => '0:0:0:0:0:0:0',
    'igar'    => '-0:0:0:1:0:0:0',
    'igår'    => '-0:0:0:1:0:0:0',
    'imorgon' => '+0:0:0:1:0:0:0',
  },
  offset_time => { nu => '0:0:0:0:0:0:0' },
  on => ['pa', 'på'],
  sephm => ['\.'],
  sepms => [':'],
  times => {
    'midnatt'       => '00:00:00',
    'mitt pa dagen' => '12:00:00',
    'mitt på dagen' => '12:00:00',
  },
  when => [['sedan'], ['om', 'senare']],
};

1;
