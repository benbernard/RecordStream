package Date::Manip::Lang::turkish;
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
$LangName  = "Turkish";
$YearAdded = 2001;

$Language = {
  ampm => [['ögleden önce', 'ogleden once'], ['öðleden sonra', 'ogleden sonra']],
  at => ['saat'],
  day_abb => [['pzt'], ['sal'], ['çar', 'car'], ['per'], ['cum'], ['cts', 'cmt'], ['paz']],
  day_char => [['Pt'], ['S'], ['Ç', 'Cr'], ['Pr'], ['C'], ['Ct'], ['P']],
  day_name => [
    ['pazartesi'],
    ['salý', 'sali'],
    ['çarþamba', 'carsamba'],
    ['perþembe', 'persembe'],
    ['cuma'],
    ['cumartesi'],
    ['pazar'],
  ],
  each => ['her'],
  fields => [
    ['yil', 'y'],
    ['ay', 'a'],
    ['hafta', 'h'],
    ['gun', 'g'],
    ['saat', 's'],
    ['dakika', 'dak', 'd'],
    ['saniye', 'sn'],
  ],
  last => ['son', 'sonuncu'],
  mode => [['tam', 'yaklasik', 'yaklaþýk'], ['is', 'iþ', 'çalýþma', 'calisma']],
  month_abb => [
    ['oca'],
    ['þub', 'sub'],
    ['mar'],
    ['nis'],
    ['may'],
    ['haz'],
    ['tem'],
    ['aðu', 'agu'],
    ['eyl'],
    ['eki'],
    ['kas'],
    ['ara'],
  ],
  month_name => [
    ['ocak'],
    ['þubat', 'subat'],
    ['mart'],
    ['nisan'],
    ['mayýs', 'mayis'],
    ['haziran'],
    ['temmuz'],
    ['aðustos', 'agustos'],
    ['eylül', 'eylul'],
    ['ekim'],
    ['kasým', 'kasim'],
    ['aralýk', 'aralik'],
  ],
  nextprev => [['gelecek', 'sonraki'], ['onceki', 'önceki']],
  nth => [
    ['1.', 'bir', 'ilk', 'birinci'],
    ['2.', 'iki', 'ikinci'],
    ['3.', 'üç', 'uc', 'üçüncü', 'ucuncu'],
    ['4.', 'dört', 'dort', 'dördüncü', 'dorduncu'],
    ['5.', 'beş', 'bes', 'beşinci', 'besinci'],
    ['6.', 'altı', 'alti', 'altıncı'],
    ['7.', 'yedi', 'yedinci'],
    ['8.', 'sekiz', 'sekizinci'],
    ['9.', 'dokuz', 'dokuzuncu'],
    ['10.', 'on', 'onuncu'],
    ['11.', 'on bir', 'on birinci'],
    ['12.', 'on iki', 'on ikinci'],
    ['13.', 'on üç', 'on uc', 'on üçüncü', 'on ucuncu'],
    ['14.', 'on dört', 'on dort', 'on dördüncü', 'on dorduncu'],
    ['15.', 'on beş', 'on bes', 'on beşinci', 'on besinci'],
    ['16.', 'on altı', 'on alti', 'on altıncı'],
    ['17.', 'on yedi', 'on yedinci'],
    ['18.', 'on sekiz', 'on sekizinci'],
    ['19.', 'on dokuz', 'on dokuzuncu'],
    ['20.', 'yirmi', 'yirminci'],
    ['21.', 'yirmi bir', 'yirminci birinci'],
    ['22.', 'yirmi iki', 'yirminci ikinci'],
    ['23.', 'yirmi üç', 'yirmi uc', 'yirminci üçüncü', 'yirminci ucuncu'],
    ['24.', 'yirmi dört', 'yirmi dort', 'yirminci dördüncü', 'yirminci dorduncu'],
    ['25.', 'yirmi beş', 'yirmi bes', 'yirminci beşinci', 'yirminci besinci'],
    ['26.', 'yirmi altı', 'yirmi alti', 'yirminci altıncı'],
    ['27.', 'yirmi yedi', 'yirminci yedinci'],
    ['28.', 'yirmi sekiz', 'yirminci sekizinci'],
    ['29.', 'yirmi dokuz', 'yirminci dokuzuncu'],
    ['30.', 'otuz', 'otuzuncu'],
    ['31.', 'otuz bir', 'otuz birinci'],
    ['32.', 'otuz iki', 'otuz ikinci'],
    ['33.', 'otuz üç', 'otuz uc', 'otuz üçüncü', 'otuz ucuncu'],
    ['34.', 'otuz dört', 'otuz dort', 'otuz dördüncü', 'otuz dorduncu'],
    ['35.', 'otuz beş', 'otuz bes', 'otuz beşinci', 'otuz besinci'],
    ['36.', 'otuz altı', 'otuz alti', 'otuz altıncı'],
    ['37.', 'otuz yedi', 'otuz yedinci'],
    ['38.', 'otuz sekiz', 'otuz sekizinci'],
    ['39.', 'otuz dokuz', 'otuz dokuzuncu'],
    ['40.', 'kırk', 'kirk', 'kırkıncı', 'kirkinci'],
    ['41.', 'kırk bir', 'kirk bir', 'kırk birinci', 'kirk birinci'],
    ['42.', 'kırk iki', 'kirk iki', 'kırk ikinci', 'kirk ikinci'],
    ['43.', 'kırk üç', 'kirk uc', 'kırk üçüncü', 'kirk ucuncu'],
    ['44.', 'kırk dört', 'kirk dort', 'kırk dördüncü', 'kirk dorduncu'],
    ['45.', 'kırk beş', 'kirk bes', 'kırk beşinci', 'kirk besinci'],
    ['46.', 'kırk altı', 'kirk alti', 'kırk altıncı', 'kirk altıncı'],
    ['47.', 'kırk yedi', 'kirk yedi', 'kırk yedinci', 'kirk yedinci'],
    ['48.', 'kırk sekiz', 'kirk sekiz', 'kırk sekizinci', 'kirk sekizinci'],
    ['49.', 'kırk dokuz', 'kirk dokuz', 'kırk dokuzuncu', 'kirk dokuzuncu'],
    ['50.', 'elli', 'ellinci'],
    ['51.', 'elli bir', 'elli birinci'],
    ['52.', 'elli iki', 'elli ikinci'],
    ['53.', 'elli üç', 'elli uc', 'elli üçüncü', 'elli ucuncu'],
  ],
  of => ['of'],
  offset_date => {
    'bugun' => '0:0:0:0:0:0:0',
    'bugün' => '0:0:0:0:0:0:0',
    'dun'   => '-0:0:0:1:0:0:0',
    'dün'   => '-0:0:0:1:0:0:0',
    'yarin' => '+0:0:0:1:0:0:0',
    'yarýn' => '+0:0:0:1:0:0:0',
  },
  offset_time => { 'simdi' => '0:0:0:0:0:0:0', 'þimdi' => '0:0:0:0:0:0:0' },
  on => ['on'],
  times => {
    'gece yarisi' => '00:00:00',
    'gece yarýsý' => '00:00:00',
    'oglen'       => '12:00:00',
    'yarim'       => '12:30:00',
    'yarým'       => '12:30:00',
    'öðlen'       => '12:00:00',
  },
  when => [['gecmis', 'geçmiþ', 'gecen', 'geçen'], ['gelecek', 'sonra']],
};

1;
