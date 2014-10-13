package #
Date::Manip::TZ::pafaka00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:09 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,1,12,35,4],'-11:24:56',[-11,-24,-56],
          'LMT',0,[1901,1,1,11,24,55],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010112:35:04','1901010111:24:55','1900123123:59:59' ],
     ],
   1901 =>
     [
        [ [1901,1,1,11,24,56],[1901,1,1,0,24,56],'-11:00:00',[-11,0,0],
          'TKT',0,[2011,12,30,10,59,59],[2011,12,29,23,59,59],
          '1901010111:24:56','1901010100:24:56','2011123010:59:59','2011122923:59:59' ],
     ],
   2011 =>
     [
        [ [2011,12,30,11,0,0],[2011,12,31,0,0,0],'+13:00:00',[13,0,0],
          'TKT',0,[9999,12,31,0,0,0],[9999,12,31,13,0,0],
          '2011123011:00:00','2011123100:00:00','9999123100:00:00','9999123113:00:00' ],
     ],
);

%LastRule      = (
);

1;
