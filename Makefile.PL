use ExtUtils::MakeMaker;

use strict;
use warnings;

require 'BuildTools.recbuildtool';

my @scripts = BuildTools::get_bin_scripts();

WriteMakefile(
   NAME          => 'App::RecordStream',
   VERSION       => '3.5_01',
   EXE_FILES     => [ map { "bin/$_" } @scripts ],
   ABSTRACT_FROM => 'README.pod',
   AUTHOR        => 'Ben Bernard - perlhacker@benjaminbernard.com '
                    . 'Keith Amling - keith.amling@gmail.com',
   LICENSE       => 'MIT',
   dist          => { COMPRESS => 'gzip -9f', SUFFIX => 'gz', },
   clean         => { FILES => 'App-RecordStream-* deb-dist testDb makedeb' },

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
      'README.pod'                => '$(INST_MAN3DIR)/RecordStream.3',
      'README.pod'                => '$(INST_MAN3DIR)/recs.3',
      'doc/Examples.pod'          => '$(INST_MAN3DIR)/recs-examples.3',
      'doc/RecordStreamStory.pod' => '$(INST_MAN3DIR)/recs-story.3',
   },

   MAN1PODS => {
      (map {( "doc/$_.pod" => "\$(INST_MAN1DIR)/$_.1" )} @scripts)
   },

   depend => {
      (map {( "doc/$_.pod" => "generate_pods" )} @scripts),
   },

   PL_FILES => {
      './generate_pods.pl' => 'generate_pods',
   },

   PM => { 
      (map {( "lib/$_" => "\$(INST_LIB)/$_" )} BuildTools::get_pms()),
   },
);
