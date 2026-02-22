package #
Date::Manip::TZ::afkamp00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:13 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,2,9,40],'+02:09:40',[2,9,40],
          'LMT',0,[1928,6,30,21,50,19],[1928,6,30,23,59,59],
          '0001010200:00:00','0001010202:09:40','1928063021:50:19','1928063023:59:59' ],
     ],
   1928 =>
     [
        [ [1928,6,30,21,50,20],[1928,7,1,0,50,20],'+03:00:00',[3,0,0],
          'EAT',0,[1929,12,31,20,59,59],[1929,12,31,23,59,59],
          '1928063021:50:20','1928070100:50:20','1929123120:59:59','1929123123:59:59' ],
     ],
   1929 =>
     [
        [ [1929,12,31,21,0,0],[1929,12,31,23,30,0],'+02:30:00',[2,30,0],
          'BEAT',0,[1947,12,31,21,29,59],[1947,12,31,23,59,59],
          '1929123121:00:00','1929123123:30:00','1947123121:29:59','1947123123:59:59' ],
     ],
   1947 =>
     [
        [ [1947,12,31,21,30,0],[1948,1,1,0,15,0],'+02:45:00',[2,45,0],
          'BEAUT',0,[1956,12,31,21,14,59],[1956,12,31,23,59,59],
          '1947123121:30:00','1948010100:15:00','1956123121:14:59','1956123123:59:59' ],
     ],
   1956 =>
     [
        [ [1956,12,31,21,15,0],[1957,1,1,0,15,0],'+03:00:00',[3,0,0],
          'EAT',0,[9999,12,31,0,0,0],[9999,12,31,3,0,0],
          '1956123121:15:00','1957010100:15:00','9999123100:00:00','9999123103:00:00' ],
     ],
);

%LastRule      = (
);

1;
