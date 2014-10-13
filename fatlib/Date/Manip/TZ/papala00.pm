package #
Date::Manip::TZ::papala00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:00 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,8,57,56],'+08:57:56',[8,57,56],
          'LMT',0,[1900,12,31,15,2,3],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010208:57:56','1900123115:02:03','1900123123:59:59' ],
     ],
   1900 =>
     [
        [ [1900,12,31,15,2,4],[1901,1,1,0,2,4],'+09:00:00',[9,0,0],
          'PWT',0,[9999,12,31,0,0,0],[9999,12,31,9,0,0],
          '1900123115:02:04','1901010100:02:04','9999123100:00:00','9999123109:00:00' ],
     ],
);

%LastRule      = (
);

1;
