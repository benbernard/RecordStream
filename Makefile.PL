use ExtUtils::MakeMaker;

use strict;
use warnings;

my $bin_dir = 'bin';
opendir(my $dh, $bin_dir) || die "can't opendir $bin_dir: $!";
my @scripts = map { "$bin_dir/$_" } grep { ! m/^\./ } readdir($dh);
closedir $dh;

WriteMakefile(
   NAME      => 'Recs',
   VERSION   => '3.3',
   EXE_FILES => \@scripts,
);
