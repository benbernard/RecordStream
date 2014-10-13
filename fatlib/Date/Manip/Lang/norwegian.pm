package Date::Manip::Lang::norwegian;
# Copyright (c) 1998-2014 Sullivan Beck. All rights reserved.
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
$LangName  = "Norwegian";
$YearAdded = 1998;

$Language = {
  ampm => [['FM'], ['EM']],
  at => ['kl', 'kl.', 'klokken'],
  day_abb => [
    ['man'],
    ['tir'],
    ['ons'],
    ['tor'],
    ['fre'],
    ['lør', 'loer'],
    ['søn', 'soen'],
  ],
  day_char => [['m'], ['ti'], ['o'], ['to'], ['f'], ['l'], ['s']],
  day_name => [
    ['mandag'],
    ['tirsdag'],
    ['onsdag'],
    ['torsdag'],
    ['fredag'],
    ['lørdag', 'loerdag'],
    ['søndag', 'soendag'],
  ],
  each => ['hver'],
  fields => [
    ['aar', 'år', 'å', 'aa'],
    ['maaneder', 'måneder', 'måned', 'mnd', 'maaned', 'mnd'],
    ['uker', 'uke', 'uk', 'ukr', 'u'],
    ['dager', 'dag', 'd'],
    ['timer', 'time', 't'],
    ['minutter', 'minutt', 'min', 'm'],
    ['sekunder', 'sekund', 'sek', 's'],
  ],
  last => ['siste'],
  mode => [['eksakt', 'cirka', 'omtrent'], ['arbeidsdag', 'arbeidsdager']],
  month_abb => [
    ['jan'],
    ['feb'],
    ['mar'],
    ['apr'],
    ['mai'],
    ['jun'],
    ['jul'],
    ['aug'],
    ['sep'],
    ['okt'],
    ['nov'],
    ['des'],
  ],
  month_name => [
    ['januar'],
    ['februar'],
    ['mars'],
    ['april'],
    ['mai'],
    ['juni'],
    ['juli'],
    ['august'],
    ['september'],
    ['oktober'],
    ['november'],
    ['desember'],
  ],
  nextprev => [['neste'], ['forrige']],
  nth => [
    ['1.', 'første', 'foerste', 'en'],
    ['2.', 'andre', 'to'],
    ['3.', 'tredje', 'tre'],
    ['4.', 'fjerde', 'fire'],
    ['5.', 'femte', 'fem'],
    ['6.', 'sjette', 'seks'],
    ['7.', 'syvende', 'syv'],
    ['8.', 'åttende', 'aattende', 'åtte', 'aatte'],
    ['9.', 'niende', 'ni'],
    ['10.', 'tiende', 'ti'],
    ['11.', 'ellevte', 'elleve'],
    ['12.', 'tolvte', 'tolv'],
    ['13.', 'trettende', 'tretten'],
    ['14.', 'fjortende', 'fjorten'],
    ['15.', 'femtende', 'femten'],
    ['16.', 'sekstende', 'seksten'],
    ['17.', 'syttende', 'sytten'],
    ['18.', 'attende', 'atten'],
    ['19.', 'nittende', 'nitten'],
    ['20.', 'tjuende', 'tjue'],
    ['21.', 'tjueførste', 'tjuefoerste', 'tjueen'],
    ['22.', 'tjueandre', 'tjueto'],
    ['23.', 'tjuetredje', 'tjuetre'],
    ['24.', 'tjuefjerde', 'tjuefire'],
    ['25.', 'tjuefemte', 'tjuefem'],
    ['26.', 'tjuesjette', 'tjueseks'],
    ['27.', 'tjuesyvende', 'tjuesyv'],
    ['28.', 'tjueåttende', 'tjueaattende', 'tjueåtte', 'tjueaatte'],
    ['29.', 'tjueniende', 'tjueni'],
    ['30.', 'trettiende', 'tretti'],
    ['31.', 'trettiførste', 'trettifoerste', 'trettien'],
    ['32.', 'trettiandre', 'trettito'],
    ['33.', 'trettitredje', 'trettitre'],
    ['34.', 'trettifjerde', 'trettifire'],
    ['35.', 'trettifemte', 'trettifem'],
    ['36.', 'trettisjette', 'trettiseks'],
    ['37.', 'trettisyvende', 'trettisyv'],
    ['38.', 'trettiåttende', 'trettiaattende', 'trettiåtte', 'trettiaatte'],
    ['39.', 'trettiniende', 'trettini'],
    ['40.', 'førtiende', 'foertiende', 'førti', 'foerti'],
    ['41.', 'førtiførste', 'foertifoerste', 'førtien', 'foertien'],
    ['42.', 'førtiandre', 'foertiandre', 'førtito', 'foertito'],
    ['43.', 'førtitredje', 'foertitredje', 'førtitre', 'foertitre'],
    ['44.', 'førtifjerde', 'foertifjerde', 'førtifire', 'foertifire'],
    ['45.', 'førtifemte', 'foertifemte', 'førtifem', 'foertifem'],
    ['46.', 'førtisjette', 'foertisjette', 'førtiseks', 'foertiseks'],
    ['47.', 'førtisyvende', 'foertisyvende', 'førtisyv', 'foertisyv'],
    ['48.', 'førtiåttende', 'foertiaattende', 'førtiåtte', 'foertiaatte'],
    ['49.', 'førtiniende', 'foertiniende', 'førtini', 'foertini'],
    ['50.', 'femtiende', 'femti'],
    ['51.', 'femtiførste', 'femtifoerste', 'femtien'],
    ['52.', 'femtiandre', 'femtito'],
    ['53.', 'femtitredje', 'femtitre'],
  ],
  of => ['første', 'foerste'],
  offset_date => {
    'i dag'    => '0:0:0:0:0:0:0',
    'i gaar'   => '-0:0:0:1:0:0:0',
    'i går'    => '-0:0:0:1:0:0:0',
    'i morgen' => '+0:0:0:1:0:0:0',
  },
  offset_time => { 'naa' => '0:0:0:0:0:0:0', 'nå' => '0:0:0:0:0:0:0' },
  on => ['på', 'paa'],
  times => {
    'midnatt'        => '00:00:00',
    'midt paa dagen' => '12:00:00',
    'midt på dagen'  => '12:00:00',
  },
  when => [['siden'], ['om', 'senere']],
};

1;
