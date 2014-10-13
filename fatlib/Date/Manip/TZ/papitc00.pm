package #
Date::Manip::TZ::papitc00;
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
        [ [1,1,2,0,0,0],[1,1,1,15,19,40],'-08:40:20',[-8,-40,-20],
          'LMT',0,[1901,1,1,8,40,19],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010115:19:40','1901010108:40:19','1900123123:59:59' ],
     ],
   1901 =>
     [
        [ [1901,1,1,8,40,20],[1901,1,1,0,10,20],'-08:30:00',[-8,-30,0],
          'PNT',0,[1998,4,27,8,29,59],[1998,4,26,23,59,59],
          '1901010108:40:20','1901010100:10:20','1998042708:29:59','1998042623:59:59' ],
     ],
   1998 =>
     [
        [ [1998,4,27,8,30,0],[1998,4,27,0,30,0],'-08:00:00',[-8,0,0],
          'PST',0,[9999,12,31,0,0,0],[9999,12,30,16,0,0],
          '1998042708:30:00','1998042700:30:00','9999123100:00:00','9999123016:00:00' ],
     ],
);

%LastRule      = (
);

1;
