package #
Date::Manip::TZ::asrang00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:13 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,6,24,40],'+06:24:40',[6,24,40],
          'LMT',0,[1879,12,31,17,35,19],[1879,12,31,23,59,59],
          '0001010200:00:00','0001010206:24:40','1879123117:35:19','1879123123:59:59' ],
     ],
   1879 =>
     [
        [ [1879,12,31,17,35,20],[1880,1,1,0,0,0],'+06:24:40',[6,24,40],
          'RMT',0,[1919,12,31,17,35,19],[1919,12,31,23,59,59],
          '1879123117:35:20','1880010100:00:00','1919123117:35:19','1919123123:59:59' ],
     ],
   1919 =>
     [
        [ [1919,12,31,17,35,20],[1920,1,1,0,5,20],'+06:30:00',[6,30,0],
          'BURT',0,[1942,4,30,17,29,59],[1942,4,30,23,59,59],
          '1919123117:35:20','1920010100:05:20','1942043017:29:59','1942043023:59:59' ],
     ],
   1942 =>
     [
        [ [1942,4,30,17,30,0],[1942,5,1,2,30,0],'+09:00:00',[9,0,0],
          'JST',0,[1945,5,2,14,59,59],[1945,5,2,23,59,59],
          '1942043017:30:00','1942050102:30:00','1945050214:59:59','1945050223:59:59' ],
     ],
   1945 =>
     [
        [ [1945,5,2,15,0,0],[1945,5,2,21,30,0],'+06:30:00',[6,30,0],
          'MMT',0,[9999,12,31,0,0,0],[9999,12,31,6,30,0],
          '1945050215:00:00','1945050221:30:00','9999123100:00:00','9999123106:30:00' ],
     ],
);

%LastRule      = (
);

1;
