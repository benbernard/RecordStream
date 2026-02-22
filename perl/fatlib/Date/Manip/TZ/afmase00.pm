package #
Date::Manip::TZ::afmase00;
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
        [ [1,1,2,0,0,0],[1,1,2,1,50,0],'+01:50:00',[1,50,0],
          'LMT',0,[1903,2,28,22,9,59],[1903,2,28,23,59,59],
          '0001010200:00:00','0001010201:50:00','1903022822:09:59','1903022823:59:59' ],
     ],
   1903 =>
     [
        [ [1903,2,28,22,10,0],[1903,3,1,0,10,0],'+02:00:00',[2,0,0],
          'SAST',0,[1943,9,18,23,59,59],[1943,9,19,1,59,59],
          '1903022822:10:00','1903030100:10:00','1943091823:59:59','1943091901:59:59' ],
     ],
   1943 =>
     [
        [ [1943,9,19,0,0,0],[1943,9,19,3,0,0],'+03:00:00',[3,0,0],
          'SAST',1,[1944,3,18,22,59,59],[1944,3,19,1,59,59],
          '1943091900:00:00','1943091903:00:00','1944031822:59:59','1944031901:59:59' ],
     ],
   1944 =>
     [
        [ [1944,3,18,23,0,0],[1944,3,19,1,0,0],'+02:00:00',[2,0,0],
          'SAST',0,[9999,12,31,0,0,0],[9999,12,31,2,0,0],
          '1944031823:00:00','1944031901:00:00','9999123100:00:00','9999123102:00:00' ],
     ],
);

%LastRule      = (
);

1;
