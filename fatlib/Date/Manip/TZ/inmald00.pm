package #
Date::Manip::TZ::inmald00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:09 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,4,54,0],'+04:54:00',[4,54,0],
          'LMT',0,[1879,12,31,19,5,59],[1879,12,31,23,59,59],
          '0001010200:00:00','0001010204:54:00','1879123119:05:59','1879123123:59:59' ],
     ],
   1879 =>
     [
        [ [1879,12,31,19,6,0],[1880,1,1,0,0,0],'+04:54:00',[4,54,0],
          'MMT',0,[1959,12,31,19,5,59],[1959,12,31,23,59,59],
          '1879123119:06:00','1880010100:00:00','1959123119:05:59','1959123123:59:59' ],
     ],
   1959 =>
     [
        [ [1959,12,31,19,6,0],[1960,1,1,0,6,0],'+05:00:00',[5,0,0],
          'MVT',0,[9999,12,31,0,0,0],[9999,12,31,5,0,0],
          '1959123119:06:00','1960010100:06:00','9999123100:00:00','9999123105:00:00' ],
     ],
);

%LastRule      = (
);

1;
