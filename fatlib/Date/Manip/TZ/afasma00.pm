package #
Date::Manip::TZ::afasma00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:02 EDT 2014
#    Data version: tzdata2014f
#    Code version: tzcode2014f

# This module contains data from the zoneinfo time zone database.  The original
# data was obtained from the URL:
#    ftp://ftp.iana.org/tz

use strict;
use warnings;
require 5.010000;

our (%Dates,%LastRule);
END {
   undef %Dates;
   undef %LastRule;
}

our ($VERSION);
$VERSION='6.47';
END { undef $VERSION; }

%Dates         = (
   1    =>
     [
        [ [1,1,2,0,0,0],[1,1,2,2,35,32],'+02:35:32',[2,35,32],
          'LMT',0,[1869,12,31,21,24,27],[1869,12,31,23,59,59],
          '0001010200:00:00','0001010202:35:32','1869123121:24:27','1869123123:59:59' ],
     ],
   1869 =>
     [
        [ [1869,12,31,21,24,28],[1870,1,1,0,0,0],'+02:35:32',[2,35,32],
          'AMT',0,[1889,12,31,21,24,27],[1889,12,31,23,59,59],
          '1869123121:24:28','1870010100:00:00','1889123121:24:27','1889123123:59:59' ],
     ],
   1889 =>
     [
        [ [1889,12,31,21,24,28],[1889,12,31,23,59,48],'+02:35:20',[2,35,20],
          'ADMT',0,[1936,5,4,21,24,39],[1936,5,4,23,59,59],
          '1889123121:24:28','1889123123:59:48','1936050421:24:39','1936050423:59:59' ],
     ],
   1936 =>
     [
        [ [1936,5,4,21,24,40],[1936,5,5,0,24,40],'+03:00:00',[3,0,0],
          'EAT',0,[9999,12,31,0,0,0],[9999,12,31,3,0,0],
          '1936050421:24:40','1936050500:24:40','9999123100:00:00','9999123103:00:00' ],
     ],
);

%LastRule      = (
);

1;
