package #
Date::Manip::TZ::askabu00;
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
        [ [1,1,2,0,0,0],[1,1,2,4,36,48],'+04:36:48',[4,36,48],
          'LMT',0,[1889,12,31,19,23,11],[1889,12,31,23,59,59],
          '0001010200:00:00','0001010204:36:48','1889123119:23:11','1889123123:59:59' ],
     ],
   1889 =>
     [
        [ [1889,12,31,19,23,12],[1889,12,31,23,23,12],'+04:00:00',[4,0,0],
          'AFT',0,[1944,12,31,19,59,59],[1944,12,31,23,59,59],
          '1889123119:23:12','1889123123:23:12','1944123119:59:59','1944123123:59:59' ],
     ],
   1944 =>
     [
        [ [1944,12,31,20,0,0],[1945,1,1,0,30,0],'+04:30:00',[4,30,0],
          'AFT',0,[9999,12,31,0,0,0],[9999,12,31,4,30,0],
          '1944123120:00:00','1945010100:30:00','9999123100:00:00','9999123104:30:00' ],
     ],
);

%LastRule      = (
);

1;
