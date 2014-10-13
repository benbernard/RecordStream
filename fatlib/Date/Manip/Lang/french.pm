package Date::Manip::Lang::french;
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
@Encodings = qw(utf-8 iso-8859-1 perl);
$LangName  = "French";
$YearAdded = 1996;

$Language = {
  ampm => [['du matin'], ['du soir']],
  at => ['a', 'à'],
  day_abb => [
    ['lun', 'lun.'],
    ['mar', 'mar.'],
    ['mer', 'mer.'],
    ['jeu', 'jeu.'],
    ['ven', 'ven.'],
    ['sam', 'sam.'],
    ['dim', 'dim.'],
  ],
  day_char => [['l'], ['ma'], ['me'], ['j'], ['v'], ['s'], ['d']],
  day_name => [
    ['lundi'],
    ['mardi'],
    ['mercredi'],
    ['jeudi'],
    ['vendredi'],
    ['samedi'],
    ['dimanche'],
  ],
  each => ['chaque', 'tous les', 'toutes les'],
  fields => [
    ['annees', 'années', 'an', 'annee', 'ans', 'année'],
    ['mois', 'm'],
    ['semaine', 'sem'],
    ['jours', 'j', 'jour', 'journee', 'journée'],
    ['heures', 'h', 'heure'],
    ['minutes', 'mn', 'min', 'minute'],
    ['secondes', 's', 'sec', 'seconde'],
  ],
  last => ['dernier'],
  mode => [
    ['exactement', 'approximativement', 'environ'],
    ['professionel', 'ouvrable', 'ouvrables'],
  ],
  month_abb => [
    ['jan', 'jan.'],
    ['fév', 'fev', 'fev.', 'fév.'],
    ['mar', 'mar.'],
    ['avr', 'avr.'],
    ['mai', 'mai.'],
    ['juin', 'juin.'],
    ['juil', 'juil.'],
    ['août', 'aout', 'aout.', 'août.'],
    ['sept', 'sept.'],
    ['oct', 'oct.'],
    ['nov', 'nov.'],
    ['déc', 'dec', 'dec.', 'déc.'],
  ],
  month_name => [
    ['janvier'],
    ['février', 'fevrier'],
    ['mars'],
    ['avril'],
    ['mai'],
    ['juin'],
    ['juillet'],
    ['août', 'aout'],
    ['septembre'],
    ['octobre'],
    ['novembre'],
    ['décembre', 'decembre'],
  ],
  nextprev => [
    ['suivant', 'suivante', 'prochaine'],
    ['precedent', 'précédent', 'precedente', 'précédente', 'derniere', 'dernière'],
  ],
  nth => [
    ['1er', '1re', 'premier', 'un'],
    ['2e', 'deux', 'deuxieme', 'deuxième'],
    ['3e', 'trois', 'troisieme', 'troisième'],
    ['4e', 'quatre', 'quatrieme', 'quatrième'],
    ['5e', 'cinq', 'cinquieme', 'cinquième'],
    ['6e', 'six', 'sixieme', 'sixième'],
    ['7e', 'sept', 'septieme', 'septième'],
    ['8e', 'huit', 'huitieme', 'huitième'],
    ['9e', 'neuf', 'neuvieme', 'neuvième'],
    ['10e', 'dix', 'dixieme', 'dixième'],
    ['11e', 'onze', 'onzieme', 'onzième'],
    ['12e', 'douze', 'douzieme', 'douzième'],
    ['13e', 'treize', 'treizieme', 'treizième'],
    ['14e', 'quatorze', 'quatorzieme', 'quatorzième'],
    ['15e', 'quinze', 'quinzieme', 'quinzième'],
    ['16e', 'seize', 'seizieme', 'seizième'],
    ['17e', 'dix-sept', 'dix-septieme', 'dix-septième'],
    ['18e', 'dix-huit', 'dix-huitieme', 'dix-huitième'],
    ['19e', 'dix-neuf', 'dix-neuvieme', 'dix-neuvième'],
    ['20e', 'vingt', 'vingtieme', 'vingtième'],
    ['21e', 'vingt et un', 'vingt et unieme', 'vingt et unième'],
    ['22e', 'vingt-deux', 'vingt-deuxieme', 'vingt-deuxième'],
    ['23e', 'vingt-trois', 'vingt-troisieme', 'vingt-troisième'],
    ['24e', 'vingt-quatre', 'vingt-quatrieme', 'vingt-quatrième'],
    ['25e', 'vingt-cinq', 'vingt-cinquieme', 'vingt-cinquième'],
    ['26e', 'vingt-six', 'vingt-sixieme', 'vingt-sixième'],
    ['27e', 'vingt-sept', 'vingt-septieme', 'vingt-septième'],
    ['28e', 'vingt-huit', 'vingt-huitieme', 'vingt-huitième'],
    ['29e', 'vingt-neuf', 'vingt-neuvieme', 'vingt-neuvième'],
    ['30e', 'trente', 'trentieme', 'trentième'],
    ['31e', 'trente et un', 'trente et unieme', 'trente et unième'],
    ['32e', 'trente-deux', 'trente-deuxieme', 'trente-deuxième'],
    ['33e', 'trente-trois', 'trente-troisieme', 'trente-troisième'],
    ['34e', 'trente-quatre', 'trente-quatrieme', 'trente-quatrième'],
    ['35e', 'trente-cinq', 'trente-cinquieme', 'trente-cinquième'],
    ['36e', 'trente-six', 'trente-sixieme', 'trente-sixième'],
    ['37e', 'trente-sept', 'trente-septieme', 'trente-septième'],
    ['38e', 'trente-huit', 'trente-huitieme', 'trente-huitième'],
    ['39e', 'trente-neuf', 'trente-neuvieme', 'trente-neuvième'],
    ['40e', 'quarante', 'quarantieme', 'quarantième'],
    ['41e', 'quarante et un', 'quarante et unieme', 'quarante et unième'],
    ['42e', 'quarante-deux', 'quarante-deuxieme', 'quarante-deuxième'],
    ['43e', 'quarante-trois', 'quarante-troisieme', 'quarante-troisième'],
    ['44e', 'quarante-quatre', 'quarante-quatrieme', 'quarante-quatrième'],
    ['45e', 'quarante-cinq', 'quarante-cinquieme', 'quarante-cinquième'],
    ['46e', 'quarante-six', 'quarante-sixieme', 'quarante-sixième'],
    ['47e', 'quarante-sept', 'quarante-septieme', 'quarante-septième'],
    ['48e', 'quarante-huit', 'quarante-huitieme', 'quarante-huitième'],
    ['49e', 'quarante-neuf', 'quarante-neuvieme', 'quarante-neuvième'],
    ['50e', 'cinquante', 'cinquantieme', 'cinquantième'],
    ['51e', 'cinquante et un', 'cinquante et unieme', 'cinquante et unième'],
    ['52e', 'cinquante-deux', 'cinquante-deuxieme', 'cinquante-deuxième'],
    ['53e', 'cinquante-trois', 'cinquante-troisieme', 'cinquante-troisième'],
  ],
  of => ['de', 'en', 'du'],
  offset_date => {
    'aujourd\'hui' => '0:0:0:0:0:0:0',
    'demain' => '+0:0:0:1:0:0:0',
    'hier' => '-0:0:0:1:0:0:0',
  },
  offset_time => { maintenant => '0:0:0:0:0:0:0' },
  on => ['sur'],
  sephm => ['h'],
  sepms => [':'],
  times => { midi => '12:00:00', minuit => '00:00:00' },
  when => [
    ['il y a', 'auparavant', 'dans le passé', 'plus tot', 'plus tôt'],
    ['en', 'plus tard', 'dans l\'avenir', 'a venir', 'à venir', 'dans'],
  ],
};

1;
