package #
Date::Manip::TZ::pakosr00;
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
        [ [1,1,2,0,0,0],[1,1,2,10,51,56],'+10:51:56',[10,51,56],
          'LMT',0,[1900,12,31,13,8,3],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010210:51:56','1900123113:08:03','1900123123:59:59' ],
     ],
   1900 =>
     [
        [ [1900,12,31,13,8,4],[1901,1,1,0,8,4],'+11:00:00',[11,0,0],
          'KOST',0,[1969,9,30,12,59,59],[1969,9,30,23,59,59],
          '1900123113:08:04','1901010100:08:04','1969093012:59:59','1969093023:59:59' ],
     ],
   1969 =>
     [
        [ [1969,9,30,13,0,0],[1969,10,1,1,0,0],'+12:00:00',[12,0,0],
          'KOST',0,[1998,12,31,11,59,59],[1998,12,31,23,59,59],
          '1969093013:00:00','1969100101:00:00','1998123111:59:59','1998123123:59:59' ],
     ],
   1998 =>
     [
        [ [1998,12,31,12,0,0],[1998,12,31,23,0,0],'+11:00:00',[11,0,0],
          'KOST',0,[9999,12,31,0,0,0],[9999,12,31,11,0,0],
          '1998123112:00:00','1998123123:00:00','9999123100:00:00','9999123111:00:00' ],
     ],
);

%LastRule      = (
);

1;
