package #
Date::Manip::TZ::ammart00;
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
        [ [1,1,2,0,0,0],[1,1,1,19,55,40],'-04:04:20',[-4,-4,-20],
          'LMT',0,[1890,1,1,4,4,19],[1889,12,31,23,59,59],
          '0001010200:00:00','0001010119:55:40','1890010104:04:19','1889123123:59:59' ],
     ],
   1890 =>
     [
        [ [1890,1,1,4,4,20],[1890,1,1,0,0,0],'-04:04:20',[-4,-4,-20],
          'FFMT',0,[1911,5,1,4,4,19],[1911,4,30,23,59,59],
          '1890010104:04:20','1890010100:00:00','1911050104:04:19','1911043023:59:59' ],
     ],
   1911 =>
     [
        [ [1911,5,1,4,4,20],[1911,5,1,0,4,20],'-04:00:00',[-4,0,0],
          'AST',0,[1980,4,6,3,59,59],[1980,4,5,23,59,59],
          '1911050104:04:20','1911050100:04:20','1980040603:59:59','1980040523:59:59' ],
     ],
   1980 =>
     [
        [ [1980,4,6,4,0,0],[1980,4,6,1,0,0],'-03:00:00',[-3,0,0],
          'ADT',1,[1980,9,28,2,59,59],[1980,9,27,23,59,59],
          '1980040604:00:00','1980040601:00:00','1980092802:59:59','1980092723:59:59' ],
        [ [1980,9,28,3,0,0],[1980,9,27,23,0,0],'-04:00:00',[-4,0,0],
          'AST',0,[9999,12,31,0,0,0],[9999,12,30,20,0,0],
          '1980092803:00:00','1980092723:00:00','9999123100:00:00','9999123020:00:00' ],
     ],
);

%LastRule      = (
);

1;
