package #
Date::Manip::TZ::asriya00;
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
        [ [1,1,2,0,0,0],[1,1,2,3,6,52],'+03:06:52',[3,6,52],
          'LMT',0,[1947,3,13,20,53,7],[1947,3,13,23,59,59],
          '0001010200:00:00','0001010203:06:52','1947031320:53:07','1947031323:59:59' ],
     ],
   1947 =>
     [
        [ [1947,3,13,20,53,8],[1947,3,13,23,53,8],'+03:00:00',[3,0,0],
          'AST',0,[9999,12,31,0,0,0],[9999,12,31,3,0,0],
          '1947031320:53:08','1947031323:53:08','9999123100:00:00','9999123103:00:00' ],
     ],
);

%LastRule      = (
);

1;
