package Date::Manip::Lang::portugue;
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
$LangName  = "Portuguese";
$YearAdded = 1999;

$Language = {
  ampm => [['AM', 'A.M.'], ['PM', 'P.M.']],
  at => ['as', 'às'],
  day_abb => [['Seg'], ['Ter'], ['Qua'], ['Qui'], ['Sex'], ['Sáb', 'Sab'], ['Dom']],
  day_char => [['Sg'], ['T'], ['Qa'], ['Qi'], ['Sx'], ['Sb'], ['D']],
  day_name => [
    ['Segunda'],
    ['Terça', 'Terca'],
    ['Quarta'],
    ['Quinta'],
    ['Sexta'],
    ['Sábado', 'Sabado'],
    ['Domingo'],
  ],
  each => ['cada'],
  fields => [
    ['anos', 'ano', 'ans', 'an', 'a'],
    ['meses', 'mês', 'mes', 'm'],
    ['semanas', 'semana', 'sem', 'sems', 's'],
    ['dias', 'dia', 'd'],
    ['horas', 'hora', 'hr', 'hrs'],
    ['minutos', 'minuto', 'min', 'mn'],
    ['segundos', 'segundo', 'seg', 'sg'],
  ],
  last => ['ultimo', 'último'],
  mode => [['exactamente', 'aproximadamente'], ['util', 'uteis']],
  month_abb => [
    ['Jan'],
    ['Fev'],
    ['Mar'],
    ['Abr'],
    ['Mai'],
    ['Jun'],
    ['Jul'],
    ['Ago'],
    ['Set'],
    ['Out'],
    ['Nov'],
    ['Dez'],
  ],
  month_name => [
    ['Janeiro'],
    ['Fevereiro'],
    ['Março', 'Marco'],
    ['Abril'],
    ['Maio'],
    ['Junho'],
    ['Julho'],
    ['Agosto'],
    ['Setembro'],
    ['Outubro'],
    ['Novembro'],
    ['Dezembro'],
  ],
  nextprev => [
    ['proxima', 'próxima', 'proximo', 'próximo'],
    ['ultima', 'última', 'ultimo', 'último'],
  ],
  nth => [
    ['1º', 'um', 'primeiro'],
    ['2º', 'dois', 'segundo'],
    ['3º', 'três', 'tres', 'terceiro'],
    ['4º', 'quatro', 'quarto'],
    ['5º', 'cinco', 'quinto'],
    ['6º', 'seis', 'sexto'],
    ['7º', 'sete', 'setimo', 'sétimo'],
    ['8º', 'oito', 'oitavo'],
    ['9º', 'nove', 'nono'],
    ['10º', 'dez', 'decimo', 'décimo'],
    ['11º', 'onze', 'decimo primeiro', 'décimo primeiro'],
    ['12º', 'doze', 'decimo segundo', 'décimo segundo'],
    ['13º', 'treze', 'decimo terceiro', 'décimo terceiro'],
    ['14º', 'quatorze', 'decimo quarto', 'décimo quarto'],
    ['15º', 'quinze', 'decimo quinto', 'décimo quinto'],
    ['16º', 'dezasseis', 'decimo sexto', 'décimo sexto'],
    ['17º', 'dezessete', 'decimo setimo', 'décimo sétimo'],
    ['18º', 'dezoito', 'decimo oitavo', 'décimo oitavo'],
    ['19º', 'dezanove', 'decimo nono', 'décimo nono'],
    ['20º', 'vinte', 'vigesimo', 'vigésimo'],
    ['21º', 'vinte e um', 'vigesimo primeiro', 'vigésimo primeiro'],
    ['22º', 'vinte e dois', 'vigesimo segundo', 'vigésimo segundo'],
    [
      '23º',
      'vinte e três',
      'vinte e tres',
      'vigesimo terceiro',
      'vigésimo terceiro',
    ],
    ['24º', 'vinte e quatro', 'vigesimo quarto', 'vigésimo quarto'],
    ['25º', 'vinte cinco', 'vigesimo quinto', 'vigésimo quinto'],
    ['26º', 'vinte seis', 'vigesimo sexto', 'vigésimo sexto'],
    ['27º', 'vinte sete', 'vigesimo setimo', 'vigésimo sétimo'],
    ['28º', 'vinte e oito', 'vigesimo oitavo', 'vigésimo oitavo'],
    ['29º', 'vinte e nove', 'vigesimo nono', 'vigésimo nono'],
    ['30º', 'trinta', 'trigesimo', 'trigésimo'],
    ['31º', 'trinta e um', 'trigesimo primeiro', 'trigésimo primeiro'],
    ['32º', 'trinta e dois', 'trigésimo segundo', 'trigesimo segundo'],
    [
      '33º',
      'trinta e três',
      'trinta e tres',
      'trigésimo terceiro',
      'trigesimo terceiro',
    ],
    ['34º', 'trinta e quatro', 'trigésimo quarto', 'trigesimo quarto'],
    ['35º', 'trinta e cinco', 'trigésimo quinto', 'trigesimo quinto'],
    ['36º', 'trinta e seis', 'trigésimo sexto', 'trigesimo sexto'],
    ['37º', 'trinta e sete', 'trigésimo sétimo', 'trigesimo setimo'],
    ['38º', 'trinta e oito', 'trigésimo oitavo', 'trigesimo oitavo'],
    ['39º', 'trinta e nove', 'trigésimo nono', 'trigesimo nono'],
    ['40º', 'quarenta', 'quadragésimo', 'quadragesimo', undef],
    ['41º', 'quarenta e um', 'quadragésimo primeiro', 'quadragesimo primeiro'],
    ['42º', 'quarenta e dois', 'quadragésimo segundo', 'quadragesimo segundo'],
    [
      '43º',
      'quarenta e três',
      'quarenta e tres',
      'quadragésimo terceiro',
      'quadragesimo terceiro',
    ],
    ['44º', 'quarenta e quatro', 'quadragésimo quarto', 'quadragesimo quarto'],
    ['45º', 'quarenta e cinco', 'quadragésimo quinto', 'quadragesimo quinto'],
    ['46º', 'quarenta e seis', 'quadragésimo sexto', 'quadragesimo sexto'],
    ['47º', 'quarenta e sete', 'quadragésimo sétimo', 'quadragesimo setimo'],
    ['48º', 'quarenta e oito', 'quadragésimo oitavo', 'quadragesimo oitavo'],
    ['49º', 'quarenta e nove', 'quadragésimo nono', 'quadragesimo nono'],
    ['50º', 'cinquenta', 'quinquagésimo', 'quinquagesimo'],
    ['51º', 'cinquenta e um', 'quinquagésimo primeiro', 'quinquagesimo primeiro'],
    ['52º', 'cinquenta e dois', 'quinquagésimo segundo', 'quinquagesimo segundo'],
    [
      '53º',
      'cinqüenta e três anos',
      'cinquenta e tres anos',
      'quinquagésimo terceiro',
      'quinquagesimo terceiro',
    ],
  ],
  of => ['da', 'do'],
  offset_date => {
    'amanha' => '+0:0:0:1:0:0:0',
    'amanhã' => '+0:0:0:1:0:0:0',
    'hoje'   => '0:0:0:0:0:0:0',
    'ontem'  => '-0:0:0:1:0:0:0',
  },
  offset_time => { agora => '0:0:0:0:0:0:0' },
  on => ['na', 'no'],
  times => { 'meia-noite' => '00:00:00', 'meio-dia' => '12:00:00' },
  when => [['a', 'à'], ['em', 'passadas', 'passados']],
};

1;
