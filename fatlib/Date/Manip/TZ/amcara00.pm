package #
Date::Manip::TZ::amcara00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:12 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,1,19,32,16],'-04:27:44',[-4,-27,-44],
          'LMT',0,[1890,1,1,4,27,43],[1889,12,31,23,59,59],
          '0001010200:00:00','0001010119:32:16','1890010104:27:43','1889123123:59:59' ],
     ],
   1890 =>
     [
        [ [1890,1,1,4,27,44],[1890,1,1,0,0,4],'-04:27:40',[-4,-27,-40],
          'CMT',0,[1912,2,12,4,27,39],[1912,2,11,23,59,59],
          '1890010104:27:44','1890010100:00:04','1912021204:27:39','1912021123:59:59' ],
     ],
   1912 =>
     [
        [ [1912,2,12,4,27,40],[1912,2,11,23,57,40],'-04:30:00',[-4,-30,0],
          'VET',0,[1965,1,1,4,29,59],[1964,12,31,23,59,59],
          '1912021204:27:40','1912021123:57:40','1965010104:29:59','1964123123:59:59' ],
     ],
   1965 =>
     [
        [ [1965,1,1,4,30,0],[1965,1,1,0,30,0],'-04:00:00',[-4,0,0],
          'VET',0,[2007,12,9,6,59,59],[2007,12,9,2,59,59],
          '1965010104:30:00','1965010100:30:00','2007120906:59:59','2007120902:59:59' ],
     ],
   2007 =>
     [
        [ [2007,12,9,7,0,0],[2007,12,9,2,30,0],'-04:30:00',[-4,-30,0],
          'VET',0,[9999,12,31,0,0,0],[9999,12,30,19,30,0],
          '2007120907:00:00','2007120902:30:00','9999123100:00:00','9999123019:30:00' ],
     ],
);

%LastRule      = (
);

1;
