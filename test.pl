#!/usr/bin/perl -w

use strict;
use warnings;

use Test::Harness;
use FindBin qw($Bin);
use Cwd ('abs_path');

my $debug = shift;

if ( $debug ) {
   $ENV{'DEBUG_CLASS'} = $debug;
   $Test::Harness::switches = '-w -d';
}


# my $dir = shift || '.';
my $dir = $Bin;

unshift @INC, "$dir/lib";
unshift @INC, "$dir/tests";
$ENV{'PATH'} = "$dir/bin:" . ($ENV{'PATH'}||'');
$ENV{'PERLLIB'} = "$dir/lib:" . ($ENV{'PERLLIB'}||'');

$ENV{'BASE_TEST_DIR'} = "$dir/tests";

my $file = shift;

if ( $file ) {
   runtests($file);
   exit;
}

my @files = `find $dir/tests -name '*.t'`;
chomp @files;

runtests(sort @files);
