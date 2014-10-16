package #
Date::Manip::TZ::andumo00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:00 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,0,0,0],'+00:00:00',[0,0,0],
          'zzz',0,[1946,12,31,23,59,59],[1946,12,31,23,59,59],
          '0001010200:00:00','0001010200:00:00','1946123123:59:59','1946123123:59:59' ],
     ],
   1947 =>
     [
        [ [1947,1,1,0,0,0],[1947,1,1,10,0,0],'+10:00:00',[10,0,0],
          'PMT',0,[1952,1,13,13,59,59],[1952,1,13,23,59,59],
          '1947010100:00:00','1947010110:00:00','1952011313:59:59','1952011323:59:59' ],
     ],
   1952 =>
     [
        [ [1952,1,13,14,0,0],[1952,1,13,14,0,0],'+00:00:00',[0,0,0],
          'zzz',0,[1956,10,31,23,59,59],[1956,10,31,23,59,59],
          '1952011314:00:00','1952011314:00:00','1956103123:59:59','1956103123:59:59' ],
     ],
   1956 =>
     [
        [ [1956,11,1,0,0,0],[1956,11,1,10,0,0],'+10:00:00',[10,0,0],
          'DDUT',0,[9999,12,31,0,0,0],[9999,12,31,10,0,0],
          '1956110100:00:00','1956110110:00:00','9999123100:00:00','9999123110:00:00' ],
     ],
);

%LastRule      = (
);

1;
