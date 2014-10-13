package #
Date::Manip::TZ::patara00;
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
        [ [1,1,2,0,0,0],[1,1,2,11,32,4],'+11:32:04',[11,32,4],
          'LMT',0,[1900,12,31,12,27,55],[1900,12,31,23,59,59],
          '0001010200:00:00','0001010211:32:04','1900123112:27:55','1900123123:59:59' ],
     ],
   1900 =>
     [
        [ [1900,12,31,12,27,56],[1901,1,1,0,27,56],'+12:00:00',[12,0,0],
          'GILT',0,[9999,12,31,0,0,0],[9999,12,31,12,0,0],
          '1900123112:27:56','1901010100:27:56','9999123100:00:00','9999123112:00:00' ],
     ],
);

%LastRule      = (
);

1;
