package #
Date::Manip::TZ::asaden00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:01 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,2,59,54],'+02:59:54',[2,59,54],
          'LMT',0,[1949,12,31,21,0,5],[1949,12,31,23,59,59],
          '0001010200:00:00','0001010202:59:54','1949123121:00:05','1949123123:59:59' ],
     ],
   1949 =>
     [
        [ [1949,12,31,21,0,6],[1950,1,1,0,0,6],'+03:00:00',[3,0,0],
          'AST',0,[9999,12,31,0,0,0],[9999,12,31,3,0,0],
          '1949123121:00:06','1950010100:00:06','9999123100:00:00','9999123103:00:00' ],
     ],
);

%LastRule      = (
);

1;
