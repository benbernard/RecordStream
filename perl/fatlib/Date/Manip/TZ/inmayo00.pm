package #
Date::Manip::TZ::inmayo00;
# Copyright (c) 2008-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

# This file was automatically generated.  Any changes to this file will
# be lost the next time 'tzdata' is run.
#    Generated on: Thu Aug 21 13:06:14 EDT 2014
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
        [ [1,1,2,0,0,0],[1,1,2,3,0,56],'+03:00:56',[3,0,56],
          'LMT',0,[1911,6,30,20,59,3],[1911,6,30,23,59,59],
          '0001010200:00:00','0001010203:00:56','1911063020:59:03','1911063023:59:59' ],
     ],
   1911 =>
     [
        [ [1911,6,30,20,59,4],[1911,6,30,23,59,4],'+03:00:00',[3,0,0],
          'EAT',0,[9999,12,31,0,0,0],[9999,12,31,3,0,0],
          '1911063020:59:04','1911063023:59:04','9999123100:00:00','9999123103:00:00' ],
     ],
);

%LastRule      = (
);

1;
