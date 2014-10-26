#!/usr/bin/env perl

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

# Try to run test suite again under minimal deps if we're an author
if ($ENV{AUTHOR_TESTING}
    and -d "$dir/../../local/lib/perl5"         # milla test happens under .build/random/
    and eval { require lib::core::only; 1 }) {

  print "# Running tests again with minimal deps\n";
  local $ENV{PERL5OPT} = "-Mlib::core::only -Mlib=$dir/lib,$dir/../../local/lib/perl5";
  runtests(sort @files);
}
