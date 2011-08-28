use ExtUtils::MakeMaker;

use strict;
use warnings;

my $bin_dir = 'bin';
opendir(my $dh, $bin_dir) || die "can't opendir $bin_dir: $!";
my @scripts = map { "$bin_dir/$_" } grep { ! m/^\./ } readdir($dh);
closedir $dh;

WriteMakefile(
   NAME          => 'App::RecordStream',
   VERSION       => '3.4_01',
   EXE_FILES     => \@scripts,
   ABSTRACT_FROM => 'README.pod',
   AUTHOR        => 'Ben Bernard - perlhacker@benjaminbernard.com '
                    . 'Keith Amling - keith.amling@gmail.com',
   LICENSE       => 'MIT',
   dist          => { COMPRESS => 'gzip -9f', SUFFIX => 'gz', },
   clean         => { FILES => 'App-RecordStream-*' },
   PREREQ_PM     => {
     'Carp'                => 0,
     'DBD::SQLite'         => 0,
     'DBI'                 => 0,
     'Date::Manip'         => 0,
     'File::Temp'          => 0,
     'FindBin'             => 0,
     'Getopt::Long'        => 0,
     'HTTP::Request'       => 0,
     'IO::String'          => 0,
     'JSON'                => 0,
     'JSON::XS'            => 0,
     'LWP'                 => 0,
     'Net::DNS::Packet'    => 0,
     'Net::Pcap'           => 0,
     'NetPacket::Ethernet' => 0,
     'Proc::ProcessTable'  => 0,
     'Test::More'          => 0,
     'Text::CSV'           => 0,
     'Tie::IxHash'         => 0,
     'XML::Simple'         => 0,
   },
   MAN3PODS => {
      'README.pod'                     => '$(INST_MAN3DIR)/RecordStream.3',
   },

);
