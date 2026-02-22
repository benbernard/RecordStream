package #
Date::Manip::TZ::afbuju00;
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
        [ [1,1,2,0,0,0],[1,1,2,1,57,28],'+01:57:28',[1,57,28],
          'LMT',0,[1889,12,31,22,2,31],[1889,12,31,23,59,59],
          '0001010200:00:00','0001010201:57:28','1889123122:02:31','1889123123:59:59' ],
     ],
   1889 =>
     [
        [ [1889,12,31,22,2,32],[1890,1,1,0,2,32],'+02:00:00',[2,0,0],
          'CAT',0,[9999,12,31,0,0,0],[9999,12,31,2,0,0],
          '1889123122:02:32','1890010100:02:32','9999123100:00:00','9999123102:00:00' ],
     ],
);

%LastRule      = (
);

1;
