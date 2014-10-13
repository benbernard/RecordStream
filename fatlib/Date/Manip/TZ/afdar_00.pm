package #
Date::Manip::TZ::afdar_00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:03 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,2,37,8],'+02:37:08',[2,37,8],
          'LMT',0,[1930,12,31,21,22,51],[1930,12,31,23,59,59],
          '0001010200:00:00','0001010202:37:08','1930123121:22:51','1930123123:59:59' ],
     ],
   1930 =>
     [
        [ [1930,12,31,21,22,52],[1931,1,1,0,22,52],'+03:00:00',[3,0,0],
          'EAT',0,[1947,12,31,20,59,59],[1947,12,31,23,59,59],
          '1930123121:22:52','1931010100:22:52','1947123120:59:59','1947123123:59:59' ],
     ],
   1947 =>
     [
        [ [1947,12,31,21,0,0],[1947,12,31,23,45,0],'+02:45:00',[2,45,0],
          'BEAUT',0,[1960,12,31,21,14,59],[1960,12,31,23,59,59],
          '1947123121:00:00','1947123123:45:00','1960123121:14:59','1960123123:59:59' ],
     ],
   1960 =>
     [
        [ [1960,12,31,21,15,0],[1961,1,1,0,15,0],'+03:00:00',[3,0,0],
          'EAT',0,[9999,12,31,0,0,0],[9999,12,31,3,0,0],
          '1960123121:15:00','1961010100:15:00','9999123100:00:00','9999123103:00:00' ],
     ],
);

%LastRule      = (
);

1;
