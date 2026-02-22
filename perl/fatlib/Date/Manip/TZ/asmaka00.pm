package #
Date::Manip::TZ::asmaka00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:04 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,7,57,36],'+07:57:36',[7,57,36],
          'LMT',0,[1919,12,31,16,2,23],[1919,12,31,23,59,59],
          '0001010200:00:00','0001010207:57:36','1919123116:02:23','1919123123:59:59' ],
     ],
   1919 =>
     [
        [ [1919,12,31,16,2,24],[1920,1,1,0,0,0],'+07:57:36',[7,57,36],
          'MMT',0,[1932,10,31,16,2,23],[1932,10,31,23,59,59],
          '1919123116:02:24','1920010100:00:00','1932103116:02:23','1932103123:59:59' ],
     ],
   1932 =>
     [
        [ [1932,10,31,16,2,24],[1932,11,1,0,2,24],'+08:00:00',[8,0,0],
          'WITA',0,[1942,2,8,15,59,59],[1942,2,8,23,59,59],
          '1932103116:02:24','1932110100:02:24','1942020815:59:59','1942020823:59:59' ],
     ],
   1942 =>
     [
        [ [1942,2,8,16,0,0],[1942,2,9,1,0,0],'+09:00:00',[9,0,0],
          'JST',0,[1945,9,22,14,59,59],[1945,9,22,23,59,59],
          '1942020816:00:00','1942020901:00:00','1945092214:59:59','1945092223:59:59' ],
     ],
   1945 =>
     [
        [ [1945,9,22,15,0,0],[1945,9,22,23,0,0],'+08:00:00',[8,0,0],
          'WITA',0,[9999,12,31,0,0,0],[9999,12,31,8,0,0],
          '1945092215:00:00','1945092223:00:00','9999123100:00:00','9999123108:00:00' ],
     ],
);

%LastRule      = (
);

1;
