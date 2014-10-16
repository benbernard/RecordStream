package Date::Manip::Lang::danish;
# Copyright (c) 2001-2014 Sullivan Beck. All rights reserved.
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
@Encodings = qw(utf-8 iso-8859-1 perl);
$LangName  = "Danish";
$YearAdded = 2001;

$Language = {
  ampm => [['FM', 'f.m.'], ['EM', 'e.m.']],
  at => ['klokken', 'kl', 'kl.'],
  day_abb => [['Man'], ['Tir'], ['Ons'], ['Tor'], ['Fre'], ['Lør', 'Lor'], ['Søn', 'Son']],
  day_char => [['M'], ['Ti'], ['O'], ['To'], ['F'], ['L'], ['S']],
  day_name => [
    ['Mandag'],
    ['Tirsdag'],
    ['Onsdag'],
    ['Torsdag'],
    ['Fredag'],
    ['Lørdag', 'Lordag'],
    ['Søndag', 'Sondag'],
  ],
  each => ['hver'],
  fields => [
    ['ar', 'år'],
    ['maneder', 'måneder', 'man', 'maned', 'mån', 'måned'],
    ['uger', 'u', 'uge'],
    ['dage', 'd', 'dag'],
    ['timer', 't', 'tim', 'time'],
    ['minutter', 'm', 'min', 'minut'],
    ['sekunder', 's', 'sek', 'sekund'],
  ],
  last => ['forrige', 'sidste', 'nyeste'],
  mode => [['pracist', 'præcist', 'circa'], ['arbejdsdag', 'arbejdsdage']],
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
    ['Januar'],
    ['Februar'],
    ['Marts'],
    ['April'],
    ['Maj'],
    ['Juni'],
    ['Juli'],
    ['August'],
    ['September'],
    ['Oktober'],
    ['November'],
    ['December'],
  ],
  nextprev => [['naste', 'næste'], ['forrige']],
  nth => [
    ['1.', 'forste', 'første', 'en'],
    ['2.', 'anden', 'to'],
    ['3.', 'tredie', 'tre'],
    ['4.', 'fjerde', 'fire'],
    ['5.', 'femte', 'fem'],
    ['6.', 'sjette', 'seks'],
    ['7.', 'syvende', 'syv'],
    ['8.', 'ottende', 'otte'],
    ['9.', 'niende', 'ni'],
    ['10.', 'tiende', 'ti'],
    ['11.', 'elfte', 'elleve'],
    ['12.', 'tolvte', 'tolv'],
    ['13.', 'trettende', 'tretten'],
    ['14.', 'fjortende', 'fjorten'],
    ['15.', 'femtende', 'femten'],
    ['16.', 'sekstende', 'seksten'],
    ['17.', 'syttende', 'sytten'],
    ['18.', 'attende', 'atten'],
    ['19.', 'nittende', 'nitten'],
    ['20.', 'tyvende', 'tyve'],
    ['21.', 'enogtyvende', 'enogtyve'],
    ['22.', 'toogtyvende', 'toogtyve'],
    ['23.', 'treogtyvende', 'treogtyve'],
    ['24.', 'fireogtyvende', 'fireogtyve'],
    ['25.', 'femogtyvende', 'femogtyve'],
    ['26.', 'seksogtyvende', 'seksogtyve'],
    ['27.', 'syvogtyvende', 'syvogtyve'],
    ['28.', 'otteogtyvende', 'otteogtyve'],
    ['29.', 'niogtyvende', 'niogtyve'],
    ['30.', 'tredivte', 'tredive'],
    ['31.', 'enogtredivte', 'enogtredive'],
    ['32.', 'toogtredivte', 'toogtredive'],
    ['33.', 'treogtredivte', 'treogtredive'],
    ['34.', 'fireogtredivte', 'fireogtredive'],
    ['35.', 'femogtredivte', 'femogtredive'],
    ['36.', 'seksogtredivte', 'seksogtredive'],
    ['37.', 'syvogtredivte', 'syvogtredive'],
    ['38.', 'otteogtredivte', 'otteogtredive'],
    ['39.', 'niogtredivte', 'niogtredive'],
    ['40.', 'fyrretyvende', 'fyrre'],
    ['41.', 'enogtyvende', 'enogtyve'],
    ['42.', 'toogtyvende', 'toogtyve'],
    ['43.', 'treogtyvende', 'treogtyve'],
    ['44.', 'fireogtyvende', 'fireogtyve'],
    ['45.', 'femogtyvende', 'femogtyve'],
    ['46.', 'seksogtyvende', 'seksogtyve'],
    ['47.', 'syvogtyvende', 'syvogtyve'],
    ['48.', 'otteogtyvende', 'otteogtyve'],
    ['49.', 'niogtyvende', 'niogtyve'],
    ['50.', 'halvtredsindstyvende', 'halvtreds'],
    ['51.', 'enogindstyvende', 'enogindstyve'],
    ['52.', 'toogindstyvende', 'toogindstyve'],
    ['53.', 'treogindstyvende', 'treogindstyve'],
  ],
  of => ['om'],
  offset_date => {
    'idag'    => '0:0:0:0:0:0:0',
    'igar'    => '-0:0:0:1:0:0:0',
    'igår'    => '-0:0:0:1:0:0:0',
    'imorgen' => '+0:0:0:1:0:0:0',
  },
  offset_time => { nu => '0:0:0:0:0:0:0' },
  on => ['pa', 'på'],
  sephm => ['\.'],
  sepms => [':'],
  times => {
    'midnat' => '00:00:00',
    'midt pa dagen' => '12:00:00',
    'midt på dagen' => '12:00:00',
  },
  when => [['siden'], ['om', 'senere']],
};

1;
