package #
Date::Manip::TZ::pasaip00;
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
        [ [1,1,2,0,0,0],[1,1,1,9,43,0],'-14:17:00',[-14,-17,0],
          'LMT',0,[1844,12,31,14,16,59],[1844,12,30,23,59,59],
          '0001010200:00:00','0001010109:43:00','1844123114:16:59','1844123023:59:59' ],
     ],
   1844 =>
     [
        [ [1844,12,31,14,17,0],[1845,1,1,0,0,0],'+09:43:00',[9,43,0],
          'LMT',0,[1900,12,31,14,16,59],[1900,12,31,23,59,59],
          '1844123114:17:00','1845010100:00:00','1900123114:16:59','1900123123:59:59' ],
     ],
   1900 =>
     [
        [ [1900,12,31,14,17,0],[1900,12,31,23,17,0],'+09:00:00',[9,0,0],
          'MPT',0,[1969,9,30,14,59,59],[1969,9,30,23,59,59],
          '1900123114:17:00','1900123123:17:00','1969093014:59:59','1969093023:59:59' ],
     ],
   1969 =>
     [
        [ [1969,9,30,15,0,0],[1969,10,1,1,0,0],'+10:00:00',[10,0,0],
          'MPT',0,[2000,12,22,13,59,59],[2000,12,22,23,59,59],
          '1969093015:00:00','1969100101:00:00','2000122213:59:59','2000122223:59:59' ],
     ],
   2000 =>
     [
        [ [2000,12,22,14,0,0],[2000,12,23,0,0,0],'+10:00:00',[10,0,0],
          'ChST',0,[9999,12,31,0,0,0],[9999,12,31,10,0,0],
          '2000122214:00:00','2000122300:00:00','9999123100:00:00','9999123110:00:00' ],
     ],
);

%LastRule      = (
);

1;
