#!/usr/bin/env perl

use strict;
use warnings;

use File::Basename qw(basename);
use Data::Dumper;
use Cwd;

my $DIRECTORY = 'tarball/RecordStream';
my $BIN_DIRECTORY = $DIRECTORY . '/bin';

my @EXTRAS = qw(
  JSON::Syck
  JSON::PP
  GD::Graph::lines
  GD::Graph::bars
  GD::Graph::points
  NetPacket::Ethernet
  NetPacket::IP
  NetPacket::TCP
  NetPacket::UDP
  NetPacket::ARP
  Net::Pcap
  Net::DNS::Packet
  Proc::ProcessTable
);

require 'BuildTools.recbuildtool';
import BuildTools qw(get_pms run_command get_bin_scripts);

$ENV{'PERL5LIB'} .= ':lib';

my $update_docs = shift @ARGV;

if ( ! defined $update_docs ) {
  $update_docs = 1;
}

create_bin_scripts();
update_docs() if $update_docs;
create_copy_files();
create_executable();
create_tarball();

sub create_executable {
  my $pp_args = create_pp_args();
  run_command('pp', @$pp_args);
}

sub create_tarball {
  my $tar_file = 'tarball/recs.tar.gz';
  run_command('tar', 'czf', $tar_file, '-C', 'tarball', 'RecordStream');
  print "Created $tar_file\n";
}

sub update_docs {
  print "Updating docs\n";
  run_command('./generate_pods.pl');
}

sub create_copy_files {
  my @copy_files = qw(LICENSE README.pod doc);

  my $translate_files = {
    (map { $_ => $_ } @copy_files),
    'INSTALLING.tarball' => 'INSTALLING',
  };

  print Dumper $translate_files;

  foreach my $from_file (keys %$translate_files) {
    my $to_file = $translate_files->{$from_file};

    my @cp_args;
    if ( -d $from_file ) {
      push @cp_args, '-r';
    }

    push @cp_args, $from_file, $DIRECTORY . '/' . $to_file;
    run_command('cp', @cp_args);
  }
}

sub create_pp_args {
  my @pms = get_pms();

  my @args = qw(-v);

  foreach my $pm (@pms, @EXTRAS) {
    push @args, '-M', $pm;
  }

  push @args, '-o', $BIN_DIRECTORY . 'recs-operation', 'bin/recs-operation';
  return \@args;
}

sub create_bin_scripts {
  my @scripts = get_bin_scripts();

  my $pwd = getcwd();
  chdir $BIN_DIRECTORY;

  foreach my $script (@scripts) {
    print "Symlinking script: $script\n";
    if ( -e $script ) {
      unlink $script;
    }
    symlink 'recs-operation', $script;
  }

  chdir $pwd;
}

