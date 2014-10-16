package #
Date::Manip::TZ::amcres00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:06 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,1,16,13,56],'-07:46:04',[-7,-46,-4],
          'LMT',0,[1884,1,1,7,46,3],[1883,12,31,23,59,59],
          '0001010200:00:00','0001010116:13:56','1884010107:46:03','1883123123:59:59' ],
     ],
   1884 =>
     [
        [ [1884,1,1,7,46,4],[1884,1,1,0,46,4],'-07:00:00',[-7,0,0],
          'MST',0,[1916,10,1,6,59,59],[1916,9,30,23,59,59],
          '1884010107:46:04','1884010100:46:04','1916100106:59:59','1916093023:59:59' ],
     ],
   1916 =>
     [
        [ [1916,10,1,7,0,0],[1916,9,30,23,0,0],'-08:00:00',[-8,0,0],
          'PST',0,[1918,6,2,7,59,59],[1918,6,1,23,59,59],
          '1916100107:00:00','1916093023:00:00','1918060207:59:59','1918060123:59:59' ],
     ],
   1918 =>
     [
        [ [1918,6,2,8,0,0],[1918,6,2,1,0,0],'-07:00:00',[-7,0,0],
          'MST',0,[9999,12,31,0,0,0],[9999,12,30,17,0,0],
          '1918060208:00:00','1918060201:00:00','9999123100:00:00','9999123017:00:00' ],
     ],
);

%LastRule      = (
);

1;
