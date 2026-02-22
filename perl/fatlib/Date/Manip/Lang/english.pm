package Date::Manip::Lang::english;
# Copyright (c) 1995-2014 Sullivan Beck. All rights reserved.
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
@Encodings = qw();
$LangName  = "English";
$YearAdded = 1995;

$Language = {
  ampm => [['AM', 'A.M.'], ['PM', 'P.M.']],
  at => ['at'],
  day_abb => [
    ['Mon', 'Mon.'],
    ['Tue', 'Tues', 'Tue.', 'Tues.'],
    ['Wed', 'Wed.'],
    ['Thu', 'Thur', 'Thu.', 'Thur.'],
    ['Fri', 'Fri.'],
    ['Sat', 'Sat.'],
    ['Sun', 'Sun.'],
  ],
  day_char => [['M'], ['T'], ['W'], ['Th'], ['F'], ['Sa'], ['S']],
  day_name => [
    ['Monday'],
    ['Tuesday'],
    ['Wednesday'],
    ['Thursday'],
    ['Friday'],
    ['Saturday'],
    ['Sunday'],
  ],
  each => ['each', 'every'],
  fields => [
    ['years', 'y', 'yr', 'year', 'yrs'],
    ['months', 'm', 'mon', 'month', 'mons'],
    ['weeks', 'w', 'wk', 'wks', 'week'],
    ['days', 'd', 'day'],
    ['hours', 'h', 'hr', 'hrs', 'hour'],
    ['minutes', 'mn', 'min', 'minute', 'mins'],
    ['seconds', 's', 'sec', 'second', 'secs'],
  ],
  last => ['last', 'final'],
  mode => [['exactly', 'approximately'], ['business']],
  month_abb => [
    ['Jan', 'Jan.'],
    ['Feb', 'Feb.'],
    ['Mar', 'Mar.'],
    ['Apr', 'Apr.'],
    ['May', 'May.'],
    ['Jun', 'Jun.'],
    ['Jul', 'Jul.'],
    ['Aug', 'Aug.'],
    ['Sep', 'Sept', 'Sep.', 'Sept.'],
    ['Oct', 'Oct.'],
    ['Nov', 'Nov.'],
    ['Dec', 'Dec.'],
  ],
  month_name => [
    ['January'],
    ['February'],
    ['March'],
    ['April'],
    ['May'],
    ['June'],
    ['July'],
    ['August'],
    ['September'],
    ['October'],
    ['November'],
    ['December'],
  ],
  nextprev => [['next', 'following'], ['previous', 'last']],
  nth => [
    ['1st', 'first', 'one'],
    ['2nd', 'second', 'two'],
    ['3rd', 'third', 'three'],
    ['4th', 'fourth', 'four'],
    ['5th', 'fifth', 'five'],
    ['6th', 'sixth', 'six'],
    ['7th', 'seventh', 'seven'],
    ['8th', 'eighth', 'eight'],
    ['9th', 'ninth', 'nine'],
    ['10th', 'tenth', 'ten'],
    ['11th', 'eleventh', 'eleven'],
    ['12th', 'twelfth', 'twelve'],
    ['13th', 'thirteenth', 'thirteen'],
    ['14th', 'fourteenth', 'fourteen'],
    ['15th', 'fifteenth', 'fifteen'],
    ['16th', 'sixteenth', 'sixteen'],
    ['17th', 'seventeenth', 'seventeen'],
    ['18th', 'eighteenth', 'eighteen'],
    ['19th', 'nineteenth', 'nineteen'],
    ['20th', 'twentieth', 'twenty'],
    ['21st', 'twenty-first', 'twenty-one'],
    ['22nd', 'twenty-second', 'twenty-two'],
    ['23rd', 'twenty-third', 'twenty-three'],
    ['24th', 'twenty-fourth', 'twenty-four'],
    ['25th', 'twenty-fifth', 'twenty-five'],
    ['26th', 'twenty-sixth', 'twenty-six'],
    ['27th', 'twenty-seventh', 'twenty-seven'],
    ['28th', 'twenty-eighth', 'twenty-eight'],
    ['29th', 'twenty-ninth', 'twenty-nine'],
    ['30th', 'thirtieth', 'thirty'],
    ['31st', 'thirty-first', 'thirty-one'],
    ['32nd', 'thirty-two', 'thirty-second'],
    ['33rd', 'thirty-three', 'thirty-third'],
    ['34th', 'thirty-four', 'thirty-fourth'],
    ['35th', 'thirty-five', 'thirty-fifth'],
    ['36th', 'thirty-six', 'thirty-sixth'],
    ['37th', 'thirty-seven', 'thirty-seventh'],
    ['38th', 'thirty-eight', 'thirty-eighth'],
    ['39th', 'thirty-nine', 'thirty-ninth'],
    ['40th', 'forty', 'fortieth'],
    ['41st', 'forty-one', 'forty-first'],
    ['42nd', 'forty-two', 'forty-second'],
    ['43rd', 'forty-three', 'forty-third'],
    ['44th', 'forty-four', 'forty-fourth'],
    ['45th', 'forty-five', 'forty-fifth'],
    ['46th', 'forty-six', 'forty-sixth'],
    ['47th', 'forty-seven', 'forty-seventh'],
    ['48th', 'forty-eight', 'forty-eighth'],
    ['49th', 'forty-nine', 'forty-ninth'],
    ['50th', 'fifty', 'fiftieth'],
    ['51st', 'fifty-one', 'fifty-first'],
    ['52nd', 'fifty-two', 'fifty-second'],
    ['53rd', 'fifty-three', 'fifty-third'],
  ],
  of => ['of', 'in'],
  offset_date => {
    ereyesterday => '-0:0:0:2:0:0:0',
    overmorrow   => '+0:0:0:2:0:0:0',
    today        => '0:0:0:0:0:0:0',
    tomorrow     => '+0:0:0:1:0:0:0',
    yesterday    => '-0:0:0:1:0:0:0',
  },
  offset_time => { now => '0:0:0:0:0:0:0' },
  on => ['on'],
  times => { midnight => '00:00:00', noon => '12:00:00' },
  when => [
    ['ago', 'past', 'in the past', 'earlier', 'before now'],
    ['in', 'later', 'future', 'in the future', 'from now'],
  ],
};

1;
