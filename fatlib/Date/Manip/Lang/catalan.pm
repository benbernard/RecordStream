package Date::Manip::Lang::catalan;
# Copyright (c) 2003-2014 Sullivan Beck. All rights reserved.
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
$LangName  = "Catalan";
$YearAdded = 2003;

$Language = {
  ampm => [['AM', 'A.M.', 'de la matinada'], ['PM', 'P.M.', 'de la tarda']],
  at => ['a les', 'a', 'al'],
  day_abb => [
    ['Dll', 'dl.', 'dl'],
    ['Dmt', 'Dim', 'dt.', 'dt'],
    ['Dmc', 'Dic', 'dc.', 'dc'],
    ['Dij', 'dj.', 'dj'],
    ['Div', 'dv.', 'dv'],
    ['Dis', 'ds.', 'ds'],
    ['Diu', 'dg.', 'dg'],
  ],
  day_char => [
    ['Dl', 'L'],
    ['Dm', 'M', 't'],
    ['Dc', 'X', 'c'],
    ['Dj', 'J'],
    ['Dv', 'V'],
    ['Ds', 'S'],
    ['Du', 'U', 'g'],
  ],
  day_name => [
    ['Dilluns'],
    ['Dimarts'],
    ['Dimecres'],
    ['Dijous'],
    ['Divendres'],
    ['Dissabte'],
    ['Diumenge'],
  ],
  each => ['cadascuna', 'cada', 'cadascun'],
  fields => [
    ['anys', 'a', 'an', 'any'],
    ['mes', 'm', 'me', 'ms'],
    ['setmanes', 's', 'se', 'set', 'setm', 'setmana'],
    ['dies', 'd', 'dia'],
    ['hores', 'h', 'ho', 'hora'],
    ['minuts', 'mn', 'min', 'minut'],
    ['segons', 's', 'seg', 'segon'],
  ],
  last => ['darrer', 'darrera', 'ultim', 'últim', 'ultima', 'última', 'passat'],
  mode => [['exactament', 'approximadament'], ['empresa']],
  month_abb => [
    ['Gen', 'gen.'],
    ['Feb', 'febr', 'feb.', 'febr.'],
    ['Mar', 'mar.'],
    ['Abr', 'abr.'],
    ['Mai', 'mai.'],
    ['Jun', 'jun.'],
    ['Jul', 'jul.'],
    ['Ago', 'ag', 'ago.', 'ag.'],
    ['Set', 'set.'],
    ['Oct', 'oct.'],
    ['Nov', 'nov.'],
    ['Des', 'Dec', 'des.', 'dec.'],
  ],
  month_name => [
    ['Gener'],
    ['Febrer'],
    ['Març', 'Marc'],
    ['Abril'],
    ['Maig'],
    ['Juny'],
    ['Juliol'],
    ['Agost'],
    ['Setembre'],
    ['Octubre'],
    ['Novembre'],
    ['Desembre'],
  ],
  nextprev => [['proper', 'seguent', 'següent'], ['passat', 'proppassat', 'anterior']],
  nth => [
    ['1er', 'primer', 'un'],
    ['2n', 'segon', 'dos'],
    ['3r', 'tercer', 'tres'],
    ['4t', 'quart', 'quatre'],
    ['5è', '5e', 'cinque', 'Cinquè', 'cinc'],
    ['6è', '6e', 'sise', 'sisè', 'sis'],
    ['7è', '7e', 'sete', 'setè', 'set'],
    ['8è', '8e', 'vuite', 'vuitè', 'vuit'],
    ['9è', '9e', 'nove', 'novè', 'nou'],
    ['10è', '10e', 'dese', 'desè', 'deu'],
    ['11è', '11e', 'onze', 'onzè'],
    ['12è', '12e', 'dotze', 'dotzè'],
    ['13è', '13e', 'tretze', 'tretzè'],
    ['14è', '14e', 'catorze', 'catorzè'],
    ['15è', '15e', 'quinze', 'quinzè'],
    ['16è', '16e', 'setze', 'setzè'],
    ['17è', '17e', 'dissete', 'dissetè', 'disset'],
    ['18è', '18e', 'divuite', 'divuitè', 'divuit'],
    ['19è', '19e', 'dinove', 'dinovèe', 'dinou'],
    ['20è', '20e', 'vinte', 'vintè', 'vint'],
    ['21è', '21e', 'vint-i-une', 'vint-i-unè', 'vint-i-u'],
    ['22è', '22e', 'vint-i-dose', 'vint-i-dosè', 'vint-i-dos'],
    ['23è', '23e', 'vint-i-trese', 'vint-i-tresè', 'vint-i-tres'],
    ['24è', '24e', 'vint-i-quatre', 'vint-i-quatrè'],
    ['25è', '25e', 'vint-i-cinque', 'vint-i-cinquè'],
    ['26è', '26e', 'vint-i-sise', 'vint-i-sisè'],
    ['27è', '27e', 'vint-i-sete', 'vint-i-setè'],
    ['28è', '28e', 'vint-i-vuite', 'vint-i-vuitè'],
    ['29è', '29e', 'vint-i-nove', 'vint-i-novè'],
    ['30è', '30e', 'trente', 'trentè', 'trenta'],
    ['31è', '31e', 'trenta-une', 'trenta-unè', 'trenta-u'],
    ['32è', '32e', 'trenta-dos'],
    ['33è', '33e', 'trenta-tres'],
    ['34è', '34e', 'trenta-quatre'],
    ['35è', '35e', 'trenta-cinc'],
    ['36è', '36e', 'trenta-sis'],
    ['37è', '37e', 'trenta-set', 'trenta-setè', 'trenta-sete'],
    ['38è', '38e', 'trenta-vuit'],
    ['39è', '39e', 'trenta-nou'],
    ['40è', '40e', 'quaranta'],
    ['41è', '41e', 'quaranta-un'],
    ['42è', '42e', 'quaranta-dos'],
    ['43è', '43e', 'quaranta-tres'],
    ['44è', '44e', 'quaranta-quatre'],
    ['45è', '45e', 'quaranta-cinc'],
    ['46è', '46e', 'quaranta-sis'],
    ['47è', '47e', 'quaranta-set'],
    ['48è', '48e', 'quaranta-vuit', 'quaranta-vuitena'],
    ['49è', '49e', 'quaranta-nou'],
    ['50è', '50e', 'cinquantè', 'cinquante'],
    ['51è', '51e', 'cinquanta-un'],
    ['52è', '52e', 'cinquanta-dos'],
    ['53è', '53e', 'cinquanta-tres'],
  ],
  of => ['de', 'd\''],
  offset_date => {
    'abans d\'ahir' => '-0:0:0:2:0:0:0',
    'ahir' => '-0:0:0:1:0:0:0',
    'dema' => '+0:0:0:1:0:0:0',
    'dema passat' => '+0:0:0:2:0:0:0',
    'demà' => '+0:0:0:1:0:0:0',
    'demà passat' => '+0:0:0:2:0:0:0',
    'idag' => '0:0:0:0:0:0:0',
  },
  offset_time => { ara => '0:0:0:0:0:0:0', avui => '0:0:0:0:0:0:0' },
  on => ['el'],
  times => { migdia => '12:00:00', mitjanit => '00:00:00' },
  when => [['fa'], ['d\'aqui a', 'd\'aquí a', 'mes tard', 'més tard']],
};

1;
