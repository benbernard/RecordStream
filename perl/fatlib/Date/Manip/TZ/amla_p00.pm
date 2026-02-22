package #
Date::Manip::TZ::amla_p00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:08 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,1,19,27,24],'-04:32:36',[-4,-32,-36],
          'LMT',0,[1890,1,1,4,32,35],[1889,12,31,23,59,59],
          '0001010200:00:00','0001010119:27:24','1890010104:32:35','1889123123:59:59' ],
     ],
   1890 =>
     [
        [ [1890,1,1,4,32,36],[1890,1,1,0,0,0],'-04:32:36',[-4,-32,-36],
          'CMT',0,[1931,10,15,4,32,35],[1931,10,14,23,59,59],
          '1890010104:32:36','1890010100:00:00','1931101504:32:35','1931101423:59:59' ],
     ],
   1931 =>
     [
        [ [1931,10,15,4,32,36],[1931,10,15,1,0,0],'-03:32:36',[-3,-32,-36],
          'BOST',1,[1932,3,21,3,32,35],[1932,3,20,23,59,59],
          '1931101504:32:36','1931101501:00:00','1932032103:32:35','1932032023:59:59' ],
     ],
   1932 =>
     [
        [ [1932,3,21,3,32,36],[1932,3,20,23,32,36],'-04:00:00',[-4,0,0],
          'BOT',0,[9999,12,31,0,0,0],[9999,12,30,20,0,0],
          '1932032103:32:36','1932032023:32:36','9999123100:00:00','9999123020:00:00' ],
     ],
);

%LastRule      = (
);

1;
