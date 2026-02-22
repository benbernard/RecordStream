package Date::Manip::Lang::italian;
# Copyright (c) 1999-2014 Sullivan Beck. All rights reserved.
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
$LangName  = "Italian";
$YearAdded = 1999;

$Language = {
  ampm => [['AM', 'm.'], ['PM', 'p.']],
  at => ['alle'],
  day_abb => [['Lun'], ['Mar'], ['Mer'], ['Gio'], ['Ven'], ['Sab'], ['Dom']],
  day_char => [['L'], ['Ma'], ['Me'], ['G'], ['V'], ['S'], ['D']],
  day_name => [
    ['Lunedì', 'Lunedi'],
    ['Martedì', 'Martedi'],
    ['Mercoledì', 'Mercoledi'],
    ['Giovedì', 'Giovedi'],
    ['Venerdì', 'Venerdi'],
    ['Sabato'],
    ['Domenica'],
  ],
  each => ['ogni'],
  fields => [
    ['anni', 'anno', 'a'],
    ['mesi', 'mese', 'mes', 'm'],
    ['settimane', 'settimana', 'sett'],
    ['giorni', 'giorno', 'g'],
    ['ore', 'ora', 'h'],
    ['minuti', 'minuto', 'min'],
    ['secondi', 's', 'secondo', 'sec'],
  ],
  last => ['ultimo'],
  mode => [['esattamente', 'circa'], ['lavorativi', 'lavorativo']],
  month_abb => [
    ['Gen'],
    ['Feb'],
    ['Mar'],
    ['Apr'],
    ['Mag'],
    ['Giu'],
    ['Lug'],
    ['Ago'],
    ['Set'],
    ['Ott'],
    ['Nov'],
    ['Dic'],
  ],
  month_name => [
    ['Gennaio'],
    ['Febbraio'],
    ['Marzo'],
    ['Aprile'],
    ['Maggio'],
    ['Giugno'],
    ['Luglio'],
    ['Agosto'],
    ['Settembre'],
    ['Ottobre'],
    ['Novembre'],
    ['Dicembre'],
  ],
  nextprev => [['prossimo'], ['ultimo']],
  nth => [
    ['1mo', 'uno', 'primo'],
    ['2do', 'due', 'secondo'],
    ['3zo', 'tre', 'terzo'],
    ['4to', 'quattro', 'quarto'],
    ['5to', 'cinque', 'quinto'],
    ['6to', 'sei', 'sesto'],
    ['7mo', 'sette', 'settimo'],
    ['8vo', 'otto', 'ottavo'],
    ['9no', 'nove', 'nono'],
    ['10mo', 'dieci', 'decimo'],
    ['11mo', 'undici', 'undicesimo'],
    ['12mo', 'dodici', 'dodicesimo'],
    ['13mo', 'tredici', 'tredicesimo'],
    ['14mo', 'quattordici', 'quattordicesimo'],
    ['15mo', 'quindici', 'quindicesimo'],
    ['16mo', 'sedici', 'sedicesimo'],
    ['17mo', 'diciassette', 'diciassettesimo'],
    ['18mo', 'diciotto', 'diciottesimo'],
    ['19mo', 'diciannove', 'diciannovesimo'],
    ['20mo', 'venti', 'ventesimo'],
    ['21mo', 'ventuno', 'ventunesimo'],
    ['22mo', 'ventidue', 'ventiduesimo'],
    ['23mo', 'ventitre', 'ventitreesimo'],
    ['24mo', 'ventiquattro', 'ventiquattresimo'],
    ['25mo', 'venticinque', 'venticinquesimo'],
    ['26mo', 'ventisei', 'ventiseiesimo'],
    ['27mo', 'ventisette', 'ventisettesimo'],
    ['28mo', 'ventotto', 'ventottesimo'],
    ['29mo', 'ventinove', 'ventinovesimo'],
    ['3mo', 'trenta', 'trentesima', 'trentesimo'],
    ['31mo', 'trentuno', 'trentunesimo'],
    ['32mo', 'trentadue', 'trentiduesima'],
    ['33mo', 'trentatré', 'trentatre', 'trentitreesime'],
    ['34mo', 'trentaquattro', 'trentiquattresimo'],
    ['35mo', 'trentacinque', 'trenticinquesima'],
    ['36mo', 'trentasei', 'trentiseisima'],
    ['37mo', 'trentasette', 'trentisettesima'],
    ['38mo', 'trentotto', 'trentiottesime'],
    ['39mo', 'trentanove', 'trentinovesime'],
    ['40mo', 'quaranta', 'quarantesimo'],
    ['41mo', 'quarantuno', 'quarantunesimo'],
    ['42mo', 'quarantadue', 'quarantiduesime'],
    ['43mo', 'quaranta', 'quarantitreesima'],
    ['44mo', 'quarantaquattro', 'quarantiquattresime'],
    ['45mo', 'quarantacinque', 'quaranticinquesima'],
    ['46mo', 'quarantasei', 'quarantiseisime'],
    ['47mo', 'quarantasette', 'quarantisettesimo'],
    ['48mo', 'quarantotto', 'quarantiottesima'],
    ['49mo', 'quarantanove', 'quarantinovesime'],
    ['50mo', 'cinquanta', 'cinquantesimo'],
    ['51mo', 'cinquantuno', 'cinquantunesimo'],
    ['52mo', 'cinquantadue', 'cinquantiduesime'],
    ['53mo', 'cinquantatré', 'cinquantatre', 'cinquantitreesimo'],
  ],
  of => ['della', 'del'],
  offset_date => {
    domani => '+0:0:0:1:0:0:0',
    ieri   => '-0:0:0:1:0:0:0',
    oggi   => '0:0:0:0:0:0:0',
  },
  offset_time => { adesso => '0:0:0:0:0:0:0' },
  on => ['di'],
  times => { mezzanotte => '00:00:00', mezzogiorno => '12:00:00' },
  when => [['fa'], ['fra', 'dopo']],
};

1;
