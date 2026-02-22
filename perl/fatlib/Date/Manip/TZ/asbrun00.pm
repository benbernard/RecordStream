package #
Date::Manip::TZ::asbrun00;
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
        [ [1,1,2,0,0,0],[1,1,2,7,39,40],'+07:39:40',[7,39,40],
          'LMT',0,[1926,2,28,16,20,19],[1926,2,28,23,59,59],
          '0001010200:00:00','0001010207:39:40','1926022816:20:19','1926022823:59:59' ],
     ],
   1926 =>
     [
        [ [1926,2,28,16,20,20],[1926,2,28,23,50,20],'+07:30:00',[7,30,0],
          'BNT',0,[1932,12,31,16,29,59],[1932,12,31,23,59,59],
          '1926022816:20:20','1926022823:50:20','1932123116:29:59','1932123123:59:59' ],
     ],
   1932 =>
     [
        [ [1932,12,31,16,30,0],[1933,1,1,0,30,0],'+08:00:00',[8,0,0],
          'BNT',0,[9999,12,31,0,0,0],[9999,12,31,8,0,0],
          '1932123116:30:00','1933010100:30:00','9999123100:00:00','9999123108:00:00' ],
     ],
);

%LastRule      = (
);

1;
