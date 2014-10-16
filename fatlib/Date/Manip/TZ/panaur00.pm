package #
Date::Manip::TZ::panaur00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:14 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,11,7,40],'+11:07:40',[11,7,40],
          'LMT',0,[1921,1,14,12,52,19],[1921,1,14,23,59,59],
          '0001010200:00:00','0001010211:07:40','1921011412:52:19','1921011423:59:59' ],
     ],
   1921 =>
     [
        [ [1921,1,14,12,52,20],[1921,1,15,0,22,20],'+11:30:00',[11,30,0],
          'NRT',0,[1942,3,14,12,29,59],[1942,3,14,23,59,59],
          '1921011412:52:20','1921011500:22:20','1942031412:29:59','1942031423:59:59' ],
     ],
   1942 =>
     [
        [ [1942,3,14,12,30,0],[1942,3,14,21,30,0],'+09:00:00',[9,0,0],
          'JST',0,[1944,8,14,14,59,59],[1944,8,14,23,59,59],
          '1942031412:30:00','1942031421:30:00','1944081414:59:59','1944081423:59:59' ],
     ],
   1944 =>
     [
        [ [1944,8,14,15,0,0],[1944,8,15,2,30,0],'+11:30:00',[11,30,0],
          'NRT',0,[1979,4,30,12,29,59],[1979,4,30,23,59,59],
          '1944081415:00:00','1944081502:30:00','1979043012:29:59','1979043023:59:59' ],
     ],
   1979 =>
     [
        [ [1979,4,30,12,30,0],[1979,5,1,0,30,0],'+12:00:00',[12,0,0],
          'NRT',0,[9999,12,31,0,0,0],[9999,12,31,12,0,0],
          '1979043012:30:00','1979050100:30:00','9999123100:00:00','9999123112:00:00' ],
     ],
);

%LastRule      = (
);

1;
