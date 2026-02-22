package #
Date::Manip::TZ::ampana00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:05 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,1,18,41,52],'-05:18:08',[-5,-18,-8],
          'LMT',0,[1890,1,1,5,18,7],[1889,12,31,23,59,59],
          '0001010200:00:00','0001010118:41:52','1890010105:18:07','1889123123:59:59' ],
     ],
   1890 =>
     [
        [ [1890,1,1,5,18,8],[1889,12,31,23,58,32],'-05:19:36',[-5,-19,-36],
          'CMT',0,[1908,4,22,5,19,35],[1908,4,21,23,59,59],
          '1890010105:18:08','1889123123:58:32','1908042205:19:35','1908042123:59:59' ],
     ],
   1908 =>
     [
        [ [1908,4,22,5,19,36],[1908,4,22,0,19,36],'-05:00:00',[-5,0,0],
          'EST',0,[9999,12,31,0,0,0],[9999,12,30,19,0,0],
          '1908042205:19:36','1908042200:19:36','9999123100:00:00','9999123019:00:00' ],
     ],
);

%LastRule      = (
);

1;
