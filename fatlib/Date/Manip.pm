package Date::Manip;
# Copyright (c) 2010-2014 Sullivan Beck.  All rights reserved.
# This program is free software; you can redistribute it and/or modify it
# under the same terms as Perl itself.

###########################################################################
###########################################################################

use warnings;
use strict;
use Exporter;

our $VERSION;
$VERSION='6.47';

our (@ISA,@EXPORT);

my $backend;

if ((exists $ENV{'DATE_MANIP'}  &&  $ENV{'DATE_MANIP'} eq 'DM5') ||
    (defined $Date::Manip::Backend  &&  $Date::Manip::Backend eq 'DM5')) {
   $backend = 'Date::Manip::DM5';

} elsif ($] >= 5.010) {
   $backend = 'Date::Manip::DM6';

} else {
   $backend = 'Date::Manip::DM5';
}

my $backend_exp = $backend . "::EXPORT";

my $flag = eval "require $backend; $backend->import(); return 'loaded';";
if (! $flag) {
   die "ERROR LOADING MODULE: $backend";
}

{
   no strict 'refs';
   @EXPORT = @{ $backend_exp };
}

unshift (@ISA, $backend);

1;
# Local Variables:
# mode: cperl
# indent-tabs-mode: nil
# cperl-indent-level: 3
# cperl-continued-statement-offset: 2
# cperl-continued-brace-offset: 0
# cperl-brace-offset: 0
# cperl-brace-imaginary-offset: 0
# cperl-label-offset: 0
# End:
