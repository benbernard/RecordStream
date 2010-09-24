#!/usr/bin/perl -w

use strict;
use warnings;

use Test::Harness;

my $debug = shift;

if ( $debug ) {
   $ENV{'DEBUG_CLASS'} = $debug;
   $Test::Harness::switches = '-w -d';
}


# my $dir = shift || '.';
my $dir = '.';

push @INC, "$dir/libs";
push @INC, "$dir/tests";

$ENV{'BASE_TEST_DIR'} = "$dir/tests";

my $file = shift;

if ( $file ) {
   runtests($file);
   exit;
}

my @files = `find $dir/tests -name '*.t'`;
chomp @files;

runtests(@files);
