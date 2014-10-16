package #
Date::Manip::TZ::asbang00;
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
        [ [1,1,2,0,0,0],[1,1,2,6,42,4],'+06:42:04',[6,42,4],
          'LMT',0,[1879,12,31,17,17,55],[1879,12,31,23,59,59],
          '0001010200:00:00','0001010206:42:04','1879123117:17:55','1879123123:59:59' ],
     ],
   1879 =>
     [
        [ [1879,12,31,17,17,56],[1880,1,1,0,0,0],'+06:42:04',[6,42,4],
          'BMT',0,[1920,3,31,17,17,55],[1920,3,31,23,59,59],
          '1879123117:17:56','1880010100:00:00','1920033117:17:55','1920033123:59:59' ],
     ],
   1920 =>
     [
        [ [1920,3,31,17,17,56],[1920,4,1,0,17,56],'+07:00:00',[7,0,0],
          'ICT',0,[9999,12,31,0,0,0],[9999,12,31,7,0,0],
          '1920033117:17:56','1920040100:17:56','9999123100:00:00','9999123107:00:00' ],
     ],
);

%LastRule      = (
);

1;
