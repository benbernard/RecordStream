package #
Date::Manip::TZ::asurum00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:10 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,5,50,20],'+05:50:20',[5,50,20],
          'LMT',0,[1927,12,31,18,9,39],[1927,12,31,23,59,59],
          '0001010200:00:00','0001010205:50:20','1927123118:09:39','1927123123:59:59' ],
     ],
   1927 =>
     [
        [ [1927,12,31,18,9,40],[1928,1,1,0,9,40],'+06:00:00',[6,0,0],
          'XJT',0,[9999,12,31,0,0,0],[9999,12,31,6,0,0],
          '1927123118:09:40','1928010100:09:40','9999123100:00:00','9999123106:00:00' ],
     ],
);

%LastRule      = (
);

1;
