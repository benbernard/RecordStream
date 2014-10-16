package #
Date::Manip::TZ::ampuer00;
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
        [ [1,1,2,0,0,0],[1,1,1,19,35,35],'-04:24:25',[-4,-24,-25],
          'LMT',0,[1899,3,28,16,24,24],[1899,3,28,11,59,59],
          '0001010200:00:00','0001010119:35:35','1899032816:24:24','1899032811:59:59' ],
     ],
   1899 =>
     [
        [ [1899,3,28,16,24,25],[1899,3,28,12,24,25],'-04:00:00',[-4,0,0],
          'AST',0,[1942,5,3,3,59,59],[1942,5,2,23,59,59],
          '1899032816:24:25','1899032812:24:25','1942050303:59:59','1942050223:59:59' ],
     ],
   1942 =>
     [
        [ [1942,5,3,4,0,0],[1942,5,3,1,0,0],'-03:00:00',[-3,0,0],
          'AWT',1,[1945,8,14,22,59,59],[1945,8,14,19,59,59],
          '1942050304:00:00','1942050301:00:00','1945081422:59:59','1945081419:59:59' ],
     ],
   1945 =>
     [
        [ [1945,8,14,23,0,0],[1945,8,14,20,0,0],'-03:00:00',[-3,0,0],
          'APT',1,[1945,9,30,4,59,59],[1945,9,30,1,59,59],
          '1945081423:00:00','1945081420:00:00','1945093004:59:59','1945093001:59:59' ],
        [ [1945,9,30,5,0,0],[1945,9,30,1,0,0],'-04:00:00',[-4,0,0],
          'AST',0,[9999,12,31,0,0,0],[9999,12,30,20,0,0],
          '1945093005:00:00','1945093001:00:00','9999123100:00:00','9999123020:00:00' ],
     ],
);

%LastRule      = (
);

1;
