package #
Date::Manip::TZ::pakwaj00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:07 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,11,9,20],'+11:09:20',[11,9,20],
          'LMT',0,[1900,12,31,12,50,39],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010211:09:20','1900123112:50:39','1900123123:59:59' ],
     ],
   1900 =>
     [
        [ [1900,12,31,12,50,40],[1900,12,31,23,50,40],'+11:00:00',[11,0,0],
          'MHT',0,[1969,9,30,12,59,59],[1969,9,30,23,59,59],
          '1900123112:50:40','1900123123:50:40','1969093012:59:59','1969093023:59:59' ],
     ],
   1969 =>
     [
        [ [1969,9,30,13,0,0],[1969,9,30,1,0,0],'-12:00:00',[-12,0,0],
          'KWAT',0,[1993,8,20,11,59,59],[1993,8,19,23,59,59],
          '1969093013:00:00','1969093001:00:00','1993082011:59:59','1993081923:59:59' ],
     ],
   1993 =>
     [
        [ [1993,8,20,12,0,0],[1993,8,21,0,0,0],'+12:00:00',[12,0,0],
          'MHT',0,[9999,12,31,0,0,0],[9999,12,31,12,0,0],
          '1993082012:00:00','1993082100:00:00','9999123100:00:00','9999123112:00:00' ],
     ],
);

%LastRule      = (
);

1;
