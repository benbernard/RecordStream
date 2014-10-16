package #
Date::Manip::TZ::paende00;
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
        [ [1,1,2,0,0,0],[1,1,1,12,35,40],'-11:24:20',[-11,-24,-20],
          'LMT',0,[1901,1,1,11,24,19],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010112:35:40','1901010111:24:19','1900123123:59:59' ],
     ],
   1901 =>
     [
        [ [1901,1,1,11,24,20],[1900,12,31,23,24,20],'-12:00:00',[-12,0,0],
          'PHOT',0,[1979,10,1,11,59,59],[1979,9,30,23,59,59],
          '1901010111:24:20','1900123123:24:20','1979100111:59:59','1979093023:59:59' ],
     ],
   1979 =>
     [
        [ [1979,10,1,12,0,0],[1979,10,1,1,0,0],'-11:00:00',[-11,0,0],
          'PHOT',0,[1995,1,1,10,59,59],[1994,12,31,23,59,59],
          '1979100112:00:00','1979100101:00:00','1995010110:59:59','1994123123:59:59' ],
     ],
   1995 =>
     [
        [ [1995,1,1,11,0,0],[1995,1,2,0,0,0],'+13:00:00',[13,0,0],
          'PHOT',0,[9999,12,31,0,0,0],[9999,12,31,13,0,0],
          '1995010111:00:00','1995010200:00:00','9999123100:00:00','9999123113:00:00' ],
     ],
);

%LastRule      = (
);

1;
