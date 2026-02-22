package #
Date::Manip::TZ::aflubu00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:11 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,1,49,52],'+01:49:52',[1,49,52],
          'LMT',0,[1897,11,8,22,10,7],[1897,11,8,23,59,59],
          '0001010200:00:00','0001010201:49:52','1897110822:10:07','1897110823:59:59' ],
     ],
   1897 =>
     [
        [ [1897,11,8,22,10,8],[1897,11,9,0,10,8],'+02:00:00',[2,0,0],
          'CAT',0,[9999,12,31,0,0,0],[9999,12,31,2,0,0],
          '1897110822:10:08','1897110900:10:08','9999123100:00:00','9999123102:00:00' ],
     ],
);

%LastRule      = (
);

1;
