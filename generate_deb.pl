#!/usr/bin/perl -w

use strict;
require 'BuildTools.recbuildtool';
use File::Glob qw(glob);

my $DIST_DIR = 'deb-dist';

my $CLEAN_COMMANDS = {
   debian    => 'rm -rf debian',
   Makefile  => 'make clean',
   $DIST_DIR => "rm -rf $DIST_DIR",
};

cleanup($CLEAN_COMMANDS);

if ( $ARGV[0] && $ARGV[0] eq '--clean' ) {
   print "Clean only, bailing!\n";
   exit 0;
}

run_command('./generate_manifest.sh');
run_command('perl Makefile.PL');
run_command('make dist');


my $tar = find_one_glob('App-RecordStream-*.tar.gz');

mkdir $DIST_DIR;
run_command("cp $tar $DIST_DIR");
chdir $DIST_DIR;
run_command("tar -xzvf $tar");

my $dir = $tar;
$dir =~ s/\.tar\.gz$//;

chdir $dir;

run_command('dh-make-perl -e ppa@benjaminbernard.com --arch all --depends gnuplot -i \'.*/fast-recs-collate/.*\'');

if ($?) {
   die "failed running dh-make-perl!";
}

run_command('sed -e \'s/perl\///g\' -i debian/control');
run_command('debuild -i -us -uc -A -b');

if ($?) {
   die "failed running debuild!";
}

chdir '..';

my $deb = find_one_glob('*.deb');
run_command("cp $deb ../");
run_command("cp $deb ../libapp-recordstream.deb");

sub cleanup {
   my $commands = shift;

   foreach my $file (keys %$commands) {
      my $command = $commands->{$file};
      if ( -e $file ) {
         run_command($command);
      }
   }
}

sub find_one_glob {
  my $glob = shift;
  my @found = glob($glob);
  
  if ( scalar @found > 1 ) {
     die "Found more than one file: " . join(' ', @found) . " for glob $glob in dir: " . $ENV{PWD};
  }

  if ( scalar @found == 0 ) {
     die "Found no files for glob: $glob in dir: $ENV{PWD}";
  }

  return $found[0];
}

sub run_command {
   return BuildTools::run_command(@_);
}
