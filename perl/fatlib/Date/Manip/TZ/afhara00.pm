package #
Date::Manip::TZ::afhara00;
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
        [ [1,1,2,0,0,0],[1,1,2,2,4,12],'+02:04:12',[2,4,12],
          'LMT',0,[1903,2,28,21,55,47],[1903,2,28,23,59,59],
          '0001010200:00:00','0001010202:04:12','1903022821:55:47','1903022823:59:59' ],
     ],
   1903 =>
     [
        [ [1903,2,28,21,55,48],[1903,2,28,23,55,48],'+02:00:00',[2,0,0],
          'CAT',0,[9999,12,31,0,0,0],[9999,12,31,2,0,0],
          '1903022821:55:48','1903022823:55:48','9999123100:00:00','9999123102:00:00' ],
     ],
);

%LastRule      = (
);

1;
