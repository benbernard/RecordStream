package #
Date::Manip::TZ::papago00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:01 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,12,37,12],'+12:37:12',[12,37,12],
          'LMT',0,[1879,7,4,11,22,47],[1879,7,4,23,59,59],
          '0001010200:00:00','0001010212:37:12','1879070411:22:47','1879070423:59:59' ],
     ],
   1879 =>
     [
        [ [1879,7,4,11,22,48],[1879,7,4,0,0,0],'-11:22:48',[-11,-22,-48],
          'LMT',0,[1911,1,1,11,22,47],[1910,12,31,23,59,59],
          '1879070411:22:48','1879070400:00:00','1911010111:22:47','1910123123:59:59' ],
     ],
   1911 =>
     [
        [ [1911,1,1,11,22,48],[1911,1,1,0,22,48],'-11:00:00',[-11,0,0],
          'NST',0,[1967,4,1,10,59,59],[1967,3,31,23,59,59],
          '1911010111:22:48','1911010100:22:48','1967040110:59:59','1967033123:59:59' ],
     ],
   1967 =>
     [
        [ [1967,4,1,11,0,0],[1967,4,1,0,0,0],'-11:00:00',[-11,0,0],
          'BST',0,[1983,11,30,10,59,59],[1983,11,29,23,59,59],
          '1967040111:00:00','1967040100:00:00','1983113010:59:59','1983112923:59:59' ],
     ],
   1983 =>
     [
        [ [1983,11,30,11,0,0],[1983,11,30,0,0,0],'-11:00:00',[-11,0,0],
          'SST',0,[9999,12,31,0,0,0],[9999,12,30,13,0,0],
          '1983113011:00:00','1983113000:00:00','9999123100:00:00','9999123013:00:00' ],
     ],
);

%LastRule      = (
);

1;
